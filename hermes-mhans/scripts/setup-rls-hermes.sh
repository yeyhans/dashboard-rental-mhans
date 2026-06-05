#!/usr/bin/env bash
# Policy RLS de SOLO LECTURA en user_profiles para los roles hermes.
#
# ROOT CAUSE que motiva este script: user_profiles tiene RLS HABILITADO
# (relrowsecurity=t) con policies solo para public/service_role/authenticated.
# Los roles hermes_ro / hermes_rw / hermes_notifier tenían GRANT SELECT pero
# NINGUNA policy los cubría → Postgres devuelve 0 filas SIN error (deny por
# defecto). El dashboard ve todo porque service_role bypassa RLS.
# Síntoma: find_client/get_client vacíos y "Cliente: —" en las notificaciones.
#
# Decisión: policy SELECT USING(true) SOLO en user_profiles y SOLO para los
# roles hermes (NO BYPASSRLS — eso anularía RLS en TODAS las tablas).
# La confidencialidad de PII la gobiernan los tools/skills (PII de a un
# cliente y solo a pedido), no el RLS: el diseño siempre quiso que el rol
# pudiera LEER (por eso el GRANT); el RLS lo anulaba silenciosamente.
#
# PRE-REQUISITO: los 3 roles deben existir (correr ANTES setup-db-role.sh,
# setup-db-role-rw.sh y setup-db-role-notifier.sh).
#
# ROLLBACK:
#   DROP POLICY IF EXISTS "Hermes agents can read user_profiles" ON public.user_profiles;
#
# Patrón EXACTO de setup-db-role-rw.sh (docker run psql como supabase_admin,
# ON_ERROR_STOP=1, idempotente via DROP IF EXISTS + CREATE).
set -euo pipefail

DB_CONTAINER=supabase-9cd8-db
DB_NET=rental-pre0225supabase-sssmcr
DB_PORT=5434

PGPW=$(docker inspect "$DB_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -oP '^POSTGRES_PASSWORD=\K.*')

echo "[setup-rls-hermes] Creando policy de lectura en user_profiles para roles hermes ..."

docker run --rm -i --network "$DB_NET" -e PGPASSWORD="$PGPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U supabase_admin -d postgres \
  -v ON_ERROR_STOP=1 <<'SQL'

-- Guard: los 3 roles deben existir antes de referenciarlos en TO (...).
DO $do$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hermes_ro')
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hermes_rw')
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hermes_notifier') THEN
        RAISE EXCEPTION 'FALLO: faltan roles hermes_* — correr antes setup-db-role*.sh';
    END IF;
END
$do$;

DROP POLICY IF EXISTS "Hermes agents can read user_profiles" ON public.user_profiles;
CREATE POLICY "Hermes agents can read user_profiles"
    ON public.user_profiles
    FOR SELECT
    TO hermes_ro, hermes_rw, hermes_notifier
    USING (true);

SQL

echo "[setup-rls-hermes] policy creada"

# Smoke: hermes_ro debe ver filas ahora (la DB del rental tiene usuarios reales).
ENV_FILE=/opt/agents/mhans/.env
RO_URL=$(grep -m1 '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2-)

COUNT=$(docker run --rm --network "$DB_NET" postgres:16-alpine \
  psql "$RO_URL" -tAc "SELECT count(*) FROM public.user_profiles" 2>&1)

case "$COUNT" in
  ''|*[!0-9]*)
    echo "[setup-rls-hermes] FALLO smoke: count no numérico: $COUNT"
    exit 1
    ;;
  0)
    echo "[setup-rls-hermes] ATENCION: hermes_ro sigue viendo 0 filas — revisar policies"
    exit 1
    ;;
  *)
    echo "[setup-rls-hermes] smoke OK: hermes_ro ve $COUNT perfiles"
    ;;
esac

echo "[setup-rls-hermes] listo."
