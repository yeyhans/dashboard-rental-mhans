#!/usr/bin/env bash
# Crea el rol de SOLO LECTURA ACOTADA hermes_notifier en el Supabase del rental.
# Permisos mínimos: SELECT en orders + user_profiles, SELECT+UPDATE en hermes_notifications.
# Carga DATABASE_URL_NOTIFIER en /opt/agents/mhans/.env (path post-F8).
# Idempotente (re-ejecutar rota la password). NUNCA imprime secretos.
#
# Patrón EXACTO de setup-db-role-rw.sh / setup-db-role.sh.
set -euo pipefail

DB_CONTAINER=supabase-9cd8-db
DB_NET=rental-pre0225supabase-sssmcr
DB_PORT=5434
ENV_FILE=/opt/agents/mhans/.env

PGPW=$(docker inspect "$DB_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -oP '^POSTGRES_PASSWORD=\K.*')
NOTPW=$(openssl rand -hex 24)

# Rol (como postgres — idempotente via \gexec)
docker run --rm -i --network "$DB_NET" -e PGPASSWORD="$PGPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -v notpw="$NOTPW" --quiet <<'SQL'
SELECT format('CREATE ROLE hermes_notifier LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT', :'notpw')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hermes_notifier') \gexec
SELECT format('ALTER ROLE hermes_notifier WITH LOGIN PASSWORD %L', :'notpw')
WHERE EXISTS (SELECT FROM pg_roles WHERE rolname = 'hermes_notifier') \gexec
GRANT CONNECT ON DATABASE postgres TO hermes_notifier;
SQL

# GRANTs como supabase_admin (owner de public.*)
docker run --rm -i --network "$DB_NET" -e PGPASSWORD="$PGPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <<'SQL'
GRANT USAGE ON SCHEMA public TO hermes_notifier;

-- Solo lectura en orders y user_profiles (PII mínima: solo nombre/apellido/telefono
-- se usan en el notifier — el JOIN trae solo esas columnas).
GRANT SELECT ON public.orders TO hermes_notifier;
GRANT SELECT ON public.user_profiles TO hermes_notifier;

-- Lectura + update en outbox (para marcar notified_at y actualizar attempts).
GRANT SELECT, UPDATE ON public.hermes_notifications TO hermes_notifier;
GRANT USAGE ON SEQUENCE public.hermes_notifications_id_seq TO hermes_notifier;

-- Explícitamente SIN: INSERT/DELETE en orders, user_profiles o cualquier otra tabla.
SQL

echo "[setup-notifier] hermes_notifier creado/actualizado"

# DATABASE_URL_NOTIFIER al .env (reemplaza si existe)
URL="postgresql://hermes_notifier:${NOTPW}@${DB_CONTAINER}:${DB_PORT}/postgres"
grep -q '^DATABASE_URL_NOTIFIER=' "$ENV_FILE" \
  && sed -i "s|^DATABASE_URL_NOTIFIER=.*|DATABASE_URL_NOTIFIER=${URL}|" "$ENV_FILE" \
  || printf '\n# Notifier (SELECT orders+user_profiles; SELECT,UPDATE hermes_notifications; sin write)\nDATABASE_URL_NOTIFIER=%s\n' "$URL" >> "$ENV_FILE"
chmod 600 "$ENV_FILE"
echo "[setup-notifier] DATABASE_URL_NOTIFIER cargada en $ENV_FILE"

# Smoke: SELECT en outbox OK / INSERT en orders DENEGADO
SMOKE_SELECT=$(docker run --rm --network "$DB_NET" -e PGPASSWORD="$NOTPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U hermes_notifier -d postgres -tAc \
  "SELECT 'SELECT-hermes_notifications-OK' FROM hermes_notifications LIMIT 1" 2>&1 || true)

case "$SMOKE_SELECT" in
  *SELECT-hermes_notifications-OK*|*0\ rows*) echo "[setup-notifier] SELECT outbox: OK" ;;
  # psql retorna 0 rows si la tabla está vacía — eso también es OK
  "") echo "[setup-notifier] SELECT outbox: OK (tabla vacía)" ;;
  *) echo "[setup-notifier] ATENCION SELECT outbox: $SMOKE_SELECT" ;;
esac

SMOKE_INSERT=$(docker run --rm --network "$DB_NET" -e PGPASSWORD="$NOTPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U hermes_notifier -d postgres -tAc \
  "INSERT INTO orders (status, customer_id, order_proyecto, billing_first_name, billing_last_name, billing_email, billing_phone)
   VALUES ('on-hold',999999,'smoke','S','T','s@t.local','+56')" 2>&1 || true)
# customer_id numérico: un UUID string fallaría el cast a bigint en el ANALYZE,
# ANTES del permission check, y el smoke no probaría permisos. Con permisos
# denegados, 'permission denied' llega antes que cualquier NOT NULL/FK violation.

case "$SMOKE_INSERT" in
  *"permission denied"*) echo "[setup-notifier] INSERT orders denegado: OK" ;;
  *) echo "[setup-notifier] ATENCION: INSERT orders no denegado — revisar: $SMOKE_INSERT" ;;
esac
