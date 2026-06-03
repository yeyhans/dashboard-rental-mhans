#!/usr/bin/env bash
# Crea el rol de SOLO LECTURA hermes_ro en el Supabase del rental y carga
# DATABASE_URL en /opt/hermes-mhans/.env. Idempotente. NUNCA imprime secretos.
set -euo pipefail

DB_CONTAINER=supabase-9cd8-db
DB_NET=rental-pre0225supabase-sssmcr
DB_PORT=5434
ENV_FILE=/opt/hermes-mhans/.env

PGPW=$(docker inspect "$DB_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -oP '^POSTGRES_PASSWORD=\K.*')
ROPW=$(openssl rand -hex 24)

# Rol read-only: idempotente (si existe, solo rota la password).
# La password entra como variable psql (-v) y se interpola con \gexec —
# nunca queda en el texto del script ni en logs.
docker run --rm -i --network "$DB_NET" -e PGPASSWORD="$PGPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -v ropw="$ROPW" --quiet <<'SQL'
SELECT format('CREATE ROLE hermes_ro LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT', :'ropw')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hermes_ro') \gexec
SELECT format('ALTER ROLE hermes_ro WITH LOGIN PASSWORD %L', :'ropw')
WHERE EXISTS (SELECT FROM pg_roles WHERE rolname = 'hermes_ro') \gexec
GRANT CONNECT ON DATABASE postgres TO hermes_ro;
SQL

# Los GRANTs sobre las tablas van como supabase_admin: en Supabase self-hosted
# el owner de public.* es supabase_admin, NO postgres (que no es superuser real
# — como postgres salen "WARNING: no privileges were granted").
docker run --rm --network "$DB_NET" -e PGPASSWORD="$PGPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c \
  'GRANT USAGE ON SCHEMA public TO hermes_ro;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO hermes_ro;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO hermes_ro;'

echo "[setup] hermes_ro creado/actualizado"

# DATABASE_URL al .env del Hermes de mhans (reemplaza si ya existe).
URL="postgresql://hermes_ro:${ROPW}@${DB_CONTAINER}:${DB_PORT}/postgres"
grep -q '^DATABASE_URL=' "$ENV_FILE" \
  && sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${URL}|" "$ENV_FILE" \
  || printf '\n# Supabase del rental (solo lectura, red interna docker)\nDATABASE_URL=%s\n' "$URL" >> "$ENV_FILE"
chmod 600 "$ENV_FILE"
echo "[setup] DATABASE_URL cargada en $ENV_FILE"

# Smoke test con el rol nuevo: cuenta de productos (dato no sensible).
docker run --rm --network "$DB_NET" -e PGPASSWORD="$ROPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U hermes_ro -d postgres -tAc \
  "select 'hermes_ro OK — products: ' || count(*) from products"

# Verificar que NO puede escribir (debe fallar).
# OJO: grep SIN -q — con pipefail, grep -q corta el pipe al primer match,
# psql muere por SIGPIPE y el pipeline "falla" aunque el match existió.
WRITE_OUT=$(docker run --rm --network "$DB_NET" -e PGPASSWORD="$ROPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U hermes_ro -d postgres -tAc \
  "create table _hermes_write_test(id int)" 2>&1 || true)
case "$WRITE_OUT" in
  *"permission denied"*) echo '[setup] write denegado: OK (solo lectura confirmado)' ;;
  *) echo "[setup] ATENCION: write no denegado — revisar: $WRITE_OUT" ;;
esac
