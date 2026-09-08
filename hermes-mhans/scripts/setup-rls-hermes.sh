#!/usr/bin/env bash
# Verifica la policy RLS de SOLO LECTURA en user_profiles para los roles hermes.
# NO EMITE DDL.
#
# ROOT CAUSE histórico que motivó esta policy (sin cambios): user_profiles tiene
# RLS HABILITADO (relrowsecurity=t) con policies solo para public/service_role/
# authenticated. Los roles hermes_ro/hermes_rw/hermes_notifier tenían GRANT SELECT
# pero ninguna policy los cubría -> Postgres devolvía 0 filas SIN error (deny por
# defecto). Síntoma: find_client/get_client vacíos y "Cliente: —" en notificaciones.
#
# Inversión de contrato (CONSOLIDADO WEB 2027, ADR-D5): la policy ahora se crea
# EXCLUSIVAMENTE por dashboard/supabase/migrations/0000_baseline.sql. Este script
# pasa de "apply" a "verify" — solo consulta pg_policies/pg_class y sale con
# código != 0 si algo diverge. El nombre del archivo NO cambia.
set -euo pipefail

# Objetivo por defecto: producción (los runbooks referencian estos valores). Sobreescribible por
# entorno para apuntar a staging o a un restore de rehearsal sin parchear el script con sed.
DB_CONTAINER=${DB_CONTAINER:-supabase-9cd8-db}
DB_NET=${DB_NET:-rental-pre0225supabase-sssmcr}
DB_PORT=${DB_PORT:-5434}

PGPW=$(docker inspect "$DB_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -oP '^POSTGRES_PASSWORD=\K.*')

echo "[setup-rls-hermes] Verificando policy de lectura en user_profiles para roles hermes (solo lectura) ..."

docker run --rm -i --network "$DB_NET" -e PGPASSWORD="$PGPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
    -- RLS debe seguir habilitado en user_profiles (no relajado por accidente)
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'user_profiles' AND n.nspname = 'public' AND c.relrowsecurity = true
    ) THEN
        RAISE EXCEPTION 'FALLO: user_profiles no tiene RLS habilitado (relrowsecurity=false)';
    END IF;

    -- La policy de los 3 roles hermes debe existir
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'user_profiles'
          AND policyname = 'Hermes agents can read user_profiles'
          AND 'hermes_ro' = ANY(string_to_array(trim(both '{}' from roles::text), ','))
          AND 'hermes_rw' = ANY(string_to_array(trim(both '{}' from roles::text), ','))
          AND 'hermes_notifier' = ANY(string_to_array(trim(both '{}' from roles::text), ','))
    ) THEN
        RAISE EXCEPTION 'FALLO: policy "Hermes agents can read user_profiles" ausente o no cubre los 3 roles hermes';
    END IF;

    RAISE NOTICE 'check duro OK: RLS habilitado + policy de lectura hermes presente';
END
$$;
SQL

echo "[setup-rls-hermes] check duro OK: policy correcta"

# Smoke: hermes_ro debe ver filas ahora (la DB del rental tiene usuarios reales).
# `postgres` no es miembro de hermes_ro (`SET ROLE` da "permission denied" —
# confirmado en T-006), así que el smoke se conecta con la DSN real de hermes_ro
# ya provisionada out-of-band (ver RESTORE_RUNBOOK.md); este script solo LEE esa
# DSN existente, nunca la genera ni la rota.
ENV_FILE=${ENV_FILE:-/opt/agents/mhans/.env}
if [ ! -f "$ENV_FILE" ] || ! grep -q '^DATABASE_URL=' "$ENV_FILE"; then
  echo "[setup-rls-hermes] smoke omitido: $ENV_FILE sin DATABASE_URL provisionada (ver RESTORE_RUNBOOK.md)"
else
  RO_URL=$(grep -m1 '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2-)

  # `|| true`: bajo `set -e` un docker/psql que falla abortaría el script AQUI, dejando el
  # diagnóstico de abajo inalcanzable — se moría sin mensaje tras una línea de éxito, que se lee
  # como un run que pasó y se detuvo porque sí. El `2>&1` ya captura el error en COUNT; dejar que
  # la asignación "triunfe" es lo que permite al `case` clasificarlo como no numérico.
  COUNT=$(docker run --rm --network "$DB_NET" postgres:16-alpine \
    psql "$RO_URL" -tAc "SELECT count(*) FROM public.user_profiles" 2>&1) || true

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
fi

echo "[setup-rls-hermes] listo (solo verificación, sin DDL)."
