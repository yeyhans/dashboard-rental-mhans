#!/usr/bin/env bash
# Crea el rol de ESCRITURA ACOTADA hermes_rw + la tabla hermes_pending_writes
# en el Supabase del rental, y carga DATABASE_URL_RW en /opt/hermes-mhans/.env.
# Idempotente (re-ejecutar rota la password). NUNCA imprime secretos.
#
# Alcance del rol (minimo privilegio — decision del blueprint):
#   - SELECT en public (lo que ya ve hermes_ro)
#   - INSERT, UPDATE SOLO en orders y order_items
#   - INSERT, UPDATE, SELECT en hermes_pending_writes
#   - JAMAS DELETE. JAMAS otras tablas (user_profiles se toca via API dashboard).
set -euo pipefail

DB_CONTAINER=supabase-9cd8-db
DB_NET=rental-pre0225supabase-sssmcr
DB_PORT=5434
ENV_FILE=/opt/hermes-mhans/.env

PGPW=$(docker inspect "$DB_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -oP '^POSTGRES_PASSWORD=\K.*')
RWPW=$(openssl rand -hex 24)

# Rol (como postgres, que tiene CREATEROLE) — idempotente via \gexec.
docker run --rm -i --network "$DB_NET" -e PGPASSWORD="$PGPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -v rwpw="$RWPW" --quiet <<'SQL'
SELECT format('CREATE ROLE hermes_rw LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT', :'rwpw')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hermes_rw') \gexec
SELECT format('ALTER ROLE hermes_rw WITH LOGIN PASSWORD %L', :'rwpw')
WHERE EXISTS (SELECT FROM pg_roles WHERE rolname = 'hermes_rw') \gexec
GRANT CONNECT ON DATABASE postgres TO hermes_rw;
SQL

# Tabla de planes pendientes + GRANTs — como supabase_admin (owner de public.*;
# verificado: como postgres los GRANT dan "no privileges were granted").
docker run --rm -i --network "$DB_NET" -e PGPASSWORD="$PGPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS public.hermes_pending_writes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  plan_json jsonb NOT NULL,
  confirmation_token text NOT NULL,
  bound_user text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  note text
);
GRANT USAGE ON SCHEMA public TO hermes_rw;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO hermes_rw;
-- OJO: en ESTA DB no existe la tabla order_items (las lineas viven en
-- orders.line_items jsonb — verificado contra information_schema).
GRANT INSERT, UPDATE ON public.orders TO hermes_rw;
GRANT INSERT, UPDATE ON public.hermes_pending_writes TO hermes_rw;
-- Secuencias: psycopg necesita nextval para INSERT con id serial.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hermes_rw;
SQL

echo "[setup] hermes_rw creado/actualizado + tabla hermes_pending_writes lista"

# DATABASE_URL_RW al .env (reemplaza si existe).
URL="postgresql://hermes_rw:${RWPW}@${DB_CONTAINER}:${DB_PORT}/postgres"
grep -q '^DATABASE_URL_RW=' "$ENV_FILE" \
  && sed -i "s|^DATABASE_URL_RW=.*|DATABASE_URL_RW=${URL}|" "$ENV_FILE" \
  || printf '\n# Escritura acotada (orders/order_items/pending_writes; sin DELETE)\nDATABASE_URL_RW=%s\n' "$URL" >> "$ENV_FILE"
chmod 600 "$ENV_FILE"
echo "[setup] DATABASE_URL_RW cargada en $ENV_FILE"

# Smoke: puede INSERT en pending_writes y NO puede DELETE en orders.
RWOUT=$(docker run --rm --network "$DB_NET" -e PGPASSWORD="$RWPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U hermes_rw -d postgres -tAc \
  "insert into hermes_pending_writes(action, plan_json, confirmation_token, expires_at) values ('smoke','{}','x', now()) returning 'INSERT-OK'; delete from hermes_pending_writes where action='smoke' returning 'DELETE-OK'" 2>&1 || true)
# stderr/stdout pueden llegar intercalados: matchear ambas señales por separado.
case "$RWOUT" in
  *INSERT-OK*) case "$RWOUT" in
    *"permission denied"*) echo '[setup] smoke OK: INSERT permitido, DELETE denegado' ;;
    *) echo "[setup] ATENCION: DELETE en pending_writes no denegado: $RWOUT" ;;
  esac ;;
  *) echo "[setup] revisar smoke (INSERT no confirmado): $RWOUT" ;;
esac
RWDEL=$(docker run --rm --network "$DB_NET" -e PGPASSWORD="$RWPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U hermes_rw -d postgres -tAc \
  "delete from orders where false" 2>&1 || true)
case "$RWDEL" in
  *"permission denied"*) echo '[setup] DELETE en orders denegado: OK' ;;
  *) echo "[setup] ATENCION: DELETE en orders no denegado — revisar: $RWDEL" ;;
esac
