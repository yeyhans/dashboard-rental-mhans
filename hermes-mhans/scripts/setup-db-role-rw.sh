#!/usr/bin/env bash
# Verifica el rol de ESCRITURA ACOTADA hermes_rw + la tabla hermes_pending_writes
# en el Supabase del rental. NO EMITE DDL.
#
# Alcance esperado del rol (mínimo privilegio — decisión del blueprint, sin cambios):
#   - SELECT en public (lo que ya ve hermes_ro)
#   - INSERT, UPDATE SOLO en orders
#   - INSERT, UPDATE, SELECT en hermes_pending_writes
#   - JAMÁS DELETE. JAMÁS otras tablas (user_profiles se toca vía API dashboard).
#
# Inversión de contrato (CONSOLIDADO WEB 2027, ADR-D5): el rol, la tabla
# hermes_pending_writes y sus grants ahora se crean EXCLUSIVAMENTE por
# dashboard/supabase/migrations/0000_baseline.sql. Este script pasa de "apply" a
# "verify" — solo consulta pg_roles / has_table_privilege y sale con código != 0
# si algo diverge. NO rota passwords ni escribe DATABASE_URL_RW (ver
# RESTORE_RUNBOOK.md). El nombre del archivo NO cambia.
set -euo pipefail

DB_CONTAINER=supabase-9cd8-db
DB_NET=rental-pre0225supabase-sssmcr
DB_PORT=5434

PGPW=$(docker inspect "$DB_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -oP '^POSTGRES_PASSWORD=\K.*')

echo "[setup-db-role-rw] Verificando rol hermes_rw + tabla hermes_pending_writes (solo lectura) ..."

docker run --rm -i --network "$DB_NET" -e PGPASSWORD="$PGPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_roles
        WHERE rolname = 'hermes_rw'
          AND rolcanlogin = true
          AND rolsuper = false
          AND rolcreatedb = false
          AND rolcreaterole = false
          AND rolinherit = false
    ) THEN
        RAISE EXCEPTION 'FALLO: rol hermes_rw no existe o sus atributos divergen de 0000_baseline.sql';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'hermes_pending_writes'
    ) THEN
        RAISE EXCEPTION 'FALLO: tabla public.hermes_pending_writes no existe (esperada desde 0000_baseline.sql)';
    END IF;

    IF NOT (
        has_table_privilege('hermes_rw', 'public.orders', 'INSERT')
        AND has_table_privilege('hermes_rw', 'public.orders', 'UPDATE')
    ) THEN
        RAISE EXCEPTION 'FALLO: hermes_rw no tiene INSERT+UPDATE en orders';
    END IF;

    IF has_table_privilege('hermes_rw', 'public.orders', 'DELETE') THEN
        RAISE EXCEPTION 'FALLO: hermes_rw tiene DELETE en orders — esto NUNCA debe otorgarse (mínimo privilegio del blueprint)';
    END IF;

    IF NOT (
        has_table_privilege('hermes_rw', 'public.hermes_pending_writes', 'INSERT')
        AND has_table_privilege('hermes_rw', 'public.hermes_pending_writes', 'UPDATE')
        AND has_table_privilege('hermes_rw', 'public.hermes_pending_writes', 'SELECT')
    ) THEN
        RAISE EXCEPTION 'FALLO: hermes_rw no tiene SELECT+INSERT+UPDATE en hermes_pending_writes';
    END IF;

    RAISE NOTICE 'check duro OK: rol hermes_rw + hermes_pending_writes con grants esperados (sin DELETE)';
END
$$;
SQL

echo "[setup-db-role-rw] check duro OK: rol hermes_rw correcto, DELETE confirmado ausente"
echo "[setup-db-role-rw] Nota: las passwords se provisionan out-of-band (ver RESTORE_RUNBOOK.md), este script no las rota ni las lee."
echo "[setup-db-role-rw] listo (solo verificación, sin DDL)."
