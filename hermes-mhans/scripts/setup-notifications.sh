#!/usr/bin/env bash
# Crea la tabla outbox hermes_notifications + función SECURITY DEFINER + trigger
# en el Supabase del rental. Idempotente.
#
# ROLLBACK si algo falla:
#   DROP TRIGGER IF EXISTS trg_hermes_notify_new_order ON public.orders;
#   DROP FUNCTION IF EXISTS public.hermes_notify_new_order();
#   DROP TABLE IF EXISTS public.hermes_notifications;
#
# Patrón EXACTO de setup-db-role-rw.sh:
#   - docker run postgres:16-alpine psql como supabase_admin (owner de public.*)
#   - ON_ERROR_STOP=1 para abortar ante cualquier error SQL
#   - Idempotente: IF NOT EXISTS + OR REPLACE
set -euo pipefail

DB_CONTAINER=supabase-9cd8-db
DB_NET=rental-pre0225supabase-sssmcr
DB_PORT=5434

PGPW=$(docker inspect "$DB_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -oP '^POSTGRES_PASSWORD=\K.*')

echo "[setup-notifications] Creando outbox hermes_notifications + trigger ..."

docker run --rm -i --network "$DB_NET" -e PGPASSWORD="$PGPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U supabase_admin -d postgres \
  -v ON_ERROR_STOP=1 <<'SQL'

-- Tabla outbox: registra cada orden nueva para notificación garantizada.
-- order_id UNIQUE garantiza dedup por INSERT ON CONFLICT DO NOTHING.
CREATE TABLE IF NOT EXISTS public.hermes_notifications (
    id           bigserial    PRIMARY KEY,
    order_id     bigint       NOT NULL UNIQUE,
    event        text         NOT NULL DEFAULT 'new_order',
    created_at   timestamptz  NOT NULL DEFAULT now(),
    notified_at  timestamptz,
    attempts     int          NOT NULL DEFAULT 0,
    last_error   text
);

-- Índice parcial sobre pendientes (notified_at IS NULL): acelera el catch-up
-- sin escanear filas ya procesadas.
CREATE INDEX IF NOT EXISTS idx_hermes_notifications_pending
    ON public.hermes_notifications (created_at)
    WHERE notified_at IS NULL;

-- Grants para el rol del notifier SOLO si ya existe (lo crea
-- setup-db-role-notifier.sh, que puede correr antes o después de este script;
-- ese script aplica estos mismos grants, así que acá son best-effort).
DO $do$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hermes_notifier') THEN
        GRANT SELECT, UPDATE ON public.hermes_notifications TO hermes_notifier;
        GRANT USAGE ON SEQUENCE public.hermes_notifications_id_seq TO hermes_notifier;
    END IF;
END
$do$;

-- Función SECURITY DEFINER: corre con permisos del owner (supabase_admin) sin
-- importar qué rol disparó el INSERT en orders (dashboard, hermes_rw, etc.).
-- El bloque BEGIN...EXCEPTION garantiza que un fallo del notify JAMÁS aborta
-- el INSERT de la orden real — la orden es el dato de negocio, la notificación
-- es best-effort en el hot path (el outbox garantiza entrega eventual).
CREATE OR REPLACE FUNCTION public.hermes_notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    BEGIN
        INSERT INTO public.hermes_notifications (order_id)
        VALUES (NEW.id)
        ON CONFLICT (order_id) DO NOTHING;

        -- pg_notify: wakeup al servicio notifier. El payload es solo un hint;
        -- el notifier SIEMPRE redrena la tabla completa al despertar.
        PERFORM pg_notify('hermes_new_order', NEW.id::text);
    EXCEPTION WHEN OTHERS THEN
        -- Loguear en stderr del postmaster sin propagar el error.
        RAISE WARNING 'hermes_notify_new_order: ignorando error (orden segura): %', SQLERRM;
        RETURN NEW;
    END;
    RETURN NEW;
END;
$$;

-- Trigger AFTER INSERT: se dispara después de que la fila de orden está
-- confirmada en la tabla — el dato de negocio ya existe antes de notificar.
DROP TRIGGER IF EXISTS trg_hermes_notify_new_order ON public.orders;
CREATE TRIGGER trg_hermes_notify_new_order
    AFTER INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.hermes_notify_new_order();

SQL

echo "[setup-notifications] outbox + trigger OK"

# ---------------------------------------------------------------------------
# (a) Check DURO: el trigger y la función DEBEN existir. Si faltan, abortamos.
#     ON_ERROR_STOP=1 + RAISE EXCEPTION garantizan exit != 0 (set -e lo propaga).
# ---------------------------------------------------------------------------
echo "[setup-notifications] Verificación dura: trigger + función presentes ..."

docker run --rm -i --network "$DB_NET" -e PGPASSWORD="$PGPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U supabase_admin -d postgres \
  -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
    -- Trigger sobre public.orders
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE t.tgname = 'trg_hermes_notify_new_order'
          AND c.relname = 'orders'
          AND n.nspname = 'public'
          AND NOT t.tgisinternal
    ) THEN
        RAISE EXCEPTION 'FALLO: trigger trg_hermes_notify_new_order no existe en public.orders';
    END IF;

    -- Función disparada por el trigger
    IF NOT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.proname = 'hermes_notify_new_order'
          AND n.nspname = 'public'
    ) THEN
        RAISE EXCEPTION 'FALLO: función public.hermes_notify_new_order() no existe';
    END IF;

    RAISE NOTICE 'check duro OK: trigger y función presentes';
END
$$;
SQL

echo "[setup-notifications] check duro OK: trigger + función presentes"

# ---------------------------------------------------------------------------
# (b) Smoke FUNCIONAL condicional: solo si hay al menos una orden real.
#     Clona la última orden (SELECT *) para satisfacer TODAS las NOT NULL
#     automáticamente, le asigna un id alto libre, la inserta dentro de una
#     transacción y verifica que el trigger pobló hermes_notifications. ROLLBACK
#     al final → no queda basura. Si orders está vacía, se omite sin fallar.
# ---------------------------------------------------------------------------
echo "[setup-notifications] Smoke funcional: clonar última orden real + verificar outbox ..."

SMOKE=$(docker run --rm --network "$DB_NET" -e PGPASSWORD="$PGPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U supabase_admin -d postgres \
  -v ON_ERROR_STOP=1 -tAc \
  "DO \$\$
   DECLARE
       v_new_id bigint;
   BEGIN
       IF NOT EXISTS (SELECT 1 FROM public.orders) THEN
           RAISE NOTICE 'smoke_skip';
           RETURN;
       END IF;

       CREATE TEMP TABLE _smoke_src ON COMMIT DROP AS
           SELECT * FROM public.orders ORDER BY id DESC LIMIT 1;

       SELECT COALESCE(MAX(id), 0) + 1000000 INTO v_new_id FROM public.orders;
       UPDATE _smoke_src SET id = v_new_id;

       INSERT INTO public.orders SELECT * FROM _smoke_src;

       IF EXISTS (SELECT 1 FROM public.hermes_notifications WHERE order_id = v_new_id) THEN
           RAISE NOTICE 'notif_ok';
       ELSE
           RAISE EXCEPTION 'smoke_fail: el trigger NO insertó en hermes_notifications para order_id=%', v_new_id;
       END IF;
   END
   \$\$;
   ROLLBACK;" 2>&1)

case "$SMOKE" in
  *notif_ok*)  echo "[setup-notifications] smoke funcional OK: el trigger pobló el outbox" ;;
  *smoke_skip*) echo "[setup-notifications] smoke funcional omitido (tabla orders vacía)" ;;
  *)
    echo "[setup-notifications] FALLO smoke funcional: $SMOKE"
    exit 1
    ;;
esac

echo "[setup-notifications] listo."
