#!/usr/bin/env bash
# Verifica el outbox hermes_notifications + función SECURITY DEFINER + trigger
# en el Supabase del rental. NO EMITE DDL.
#
# Inversión de contrato (CONSOLIDADO WEB 2027, ADR-D5): estos objetos ahora se crean
# EXCLUSIVAMENTE por dashboard/supabase/migrations/0000_baseline.sql. Este script
# pasa de "apply" a "verify" — solo consulta pg_trigger/pg_proc/pg_class/pg_index
# y sale con código != 0 si algo diverge de lo que la cadena de migraciones declara.
# El nombre del archivo NO cambia (referenciado por GUIA.md y runbooks de deploy).
#
# Uso: correr después de cualquier restore/migración para confirmar que el
# outbox de notificaciones está intacto, sin volver a aplicar DDL manualmente.
set -euo pipefail

# Objetivo por defecto: producción (los runbooks referencian estos valores). Sobreescribible por
# entorno para apuntar a staging o a un restore de rehearsal sin parchear el script con sed.
DB_CONTAINER=${DB_CONTAINER:-supabase-9cd8-db}
DB_NET=${DB_NET:-rental-pre0225supabase-sssmcr}
DB_PORT=${DB_PORT:-5434}

PGPW=$(docker inspect "$DB_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -oP '^POSTGRES_PASSWORD=\K.*')

echo "[setup-notifications] Verificando outbox hermes_notifications + trigger (solo lectura) ..."

docker run --rm -i --network "$DB_NET" -e PGPASSWORD="$PGPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
    -- Tabla outbox
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'hermes_notifications'
    ) THEN
        RAISE EXCEPTION 'FALLO: tabla public.hermes_notifications no existe (esperada desde 0000_baseline.sql)';
    END IF;

    -- Índice parcial sobre pendientes
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'hermes_notifications'
          AND indexname = 'idx_hermes_notifications_pending'
    ) THEN
        RAISE EXCEPTION 'FALLO: índice idx_hermes_notifications_pending no existe en hermes_notifications';
    END IF;

    -- UNIQUE(order_id) — dedup del outbox
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public' AND table_name = 'hermes_notifications'
          AND constraint_type = 'UNIQUE'
    ) THEN
        RAISE EXCEPTION 'FALLO: hermes_notifications.order_id no tiene constraint UNIQUE';
    END IF;

    -- Función SECURITY DEFINER
    IF NOT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.proname = 'hermes_notify_new_order'
          AND n.nspname = 'public'
          AND p.prosecdef = true
    ) THEN
        RAISE EXCEPTION 'FALLO: función public.hermes_notify_new_order() no existe o no es SECURITY DEFINER';
    END IF;

    -- Trigger AFTER INSERT sobre public.orders
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

    -- Exactamente un trigger activo (guarda contra doble-fire por re-apply sin
    -- DROP TRIGGER IF EXISTS — ver design.md "Failure Modes: Trigger double-fire")
    IF (
        SELECT count(*) FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        WHERE t.tgname = 'trg_hermes_notify_new_order'
          AND c.relname = 'orders'
          AND NOT t.tgisinternal
    ) <> 1 THEN
        RAISE EXCEPTION 'FALLO: se esperaba exactamente 1 trigger trg_hermes_notify_new_order, encontrado otro número';
    END IF;

    -- hermes_notifier debe poder leer/actualizar el outbox (grant de 0000_baseline.sql)
    IF NOT (
        has_table_privilege('hermes_notifier', 'public.hermes_notifications', 'SELECT')
        AND has_table_privilege('hermes_notifier', 'public.hermes_notifications', 'UPDATE')
    ) THEN
        RAISE EXCEPTION 'FALLO: hermes_notifier no tiene SELECT+UPDATE en hermes_notifications';
    END IF;

    RAISE NOTICE 'check duro OK: outbox + trigger + función + grants presentes';
END
$$;
SQL

echo "[setup-notifications] check duro OK"

# ---------------------------------------------------------------------------
# Smoke funcional condicional: solo si hay al menos una orden real. Clona la
# última orden dentro de una transacción, verifica que el trigger pobló el
# outbox, y hace ROLLBACK — no queda basura ni se llega a re-aplicar DDL.
# ---------------------------------------------------------------------------
echo "[setup-notifications] Smoke funcional: clonar última orden real + verificar outbox ..."

SMOKE=$(docker run --rm --network "$DB_NET" -e PGPASSWORD="$PGPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U postgres -d postgres \
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
           RAISE NOTICE 'notif_ok:%', v_new_id;
       ELSE
           RAISE EXCEPTION 'smoke_fail: el trigger NO insertó en hermes_notifications para order_id=%', v_new_id;
       END IF;
   END
   \$\$;
   ROLLBACK;" 2>&1)

case "$SMOKE" in
  *notif_ok*)
    echo "[setup-notifications] smoke funcional OK: el trigger pobló el outbox"
    # R3-006: la transacción implícita del ROLLBACK arriba se confía "a ciegas" si no se
    # verifica — este check post-hoc confirma que la fila clonada realmente desapareció
    # (orders Y hermes_notifications) en lugar de asumir que ROLLBACK funcionó.
    SMOKE_ID=$(echo "$SMOKE" | grep -oP 'notif_ok:\K[0-9]+' | head -1)
    if [ -n "$SMOKE_ID" ]; then
      POST_ROLLBACK=$(docker run --rm --network "$DB_NET" -e PGPASSWORD="$PGPW" postgres:16-alpine \
        psql -h "$DB_CONTAINER" -p "$DB_PORT" -U postgres -d postgres -tAc \
        "SELECT (SELECT count(*) FROM public.orders WHERE id = $SMOKE_ID) + (SELECT count(*) FROM public.hermes_notifications WHERE order_id = $SMOKE_ID);" 2>&1)
      if [ "$POST_ROLLBACK" = "0" ]; then
        echo "[setup-notifications] post-ROLLBACK verificado: order_id=$SMOKE_ID no existe en orders ni hermes_notifications"
      else
        echo "[setup-notifications] FALLO: el ROLLBACK del smoke no limpió order_id=$SMOKE_ID (residual=$POST_ROLLBACK)"
        exit 1
      fi
    else
      echo "[setup-notifications] ATENCION: no se pudo extraer el smoke_id para verificar el ROLLBACK"
      exit 1
    fi
    ;;
  *smoke_skip*) echo "[setup-notifications] smoke funcional omitido (tabla orders vacía)" ;;
  *)
    echo "[setup-notifications] FALLO smoke funcional: $SMOKE"
    exit 1
    ;;
esac

echo "[setup-notifications] listo (solo verificación, sin DDL)."
