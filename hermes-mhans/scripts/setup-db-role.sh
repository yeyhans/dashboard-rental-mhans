#!/usr/bin/env bash
# Verifica el rol de SOLO LECTURA hermes_ro en el Supabase del rental. NO EMITE DDL.
#
# Inversión de contrato (CONSOLIDADO WEB 2027, ADR-D5): el rol y sus grants ahora se
# crean EXCLUSIVAMENTE por dashboard/supabase/migrations/0000_baseline.sql (rol) y
# 0002_hermes_least_privilege.sql (ADR-D8, allowlist explícito — hasta que esa
# migración aterrice, hermes_ro sigue con el default privilege amplio capturado en
# el baseline). Este script pasa de "apply" a "verify": solo consulta pg_roles /
# information_schema.role_table_grants / pg_default_acl y sale con código != 0 si
# algo diverge. NO rota passwords ni escribe DATABASE_URL — la provisión de
# passwords out-of-band vive en dashboard/supabase/migrations/RESTORE_RUNBOOK.md.
# El nombre del archivo NO cambia (referenciado por GUIA.md y runbooks de deploy).
set -euo pipefail

DB_CONTAINER=supabase-9cd8-db
DB_NET=rental-pre0225supabase-sssmcr
DB_PORT=5434

PGPW=$(docker inspect "$DB_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -oP '^POSTGRES_PASSWORD=\K.*')

echo "[setup-db-role] Verificando rol hermes_ro (solo lectura) ..."

docker run --rm -i --network "$DB_NET" -e PGPASSWORD="$PGPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_roles
        WHERE rolname = 'hermes_ro'
          AND rolcanlogin = true
          AND rolsuper = false
          AND rolcreatedb = false
          AND rolcreaterole = false
          AND rolinherit = false
    ) THEN
        RAISE EXCEPTION 'FALLO: rol hermes_ro no existe o sus atributos divergen de 0000_baseline.sql (LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT)';
    END IF;

    IF NOT has_schema_privilege('hermes_ro', 'public', 'USAGE') THEN
        RAISE EXCEPTION 'FALLO: hermes_ro no tiene USAGE en schema public';
    END IF;

    -- Mientras 0002_hermes_least_privilege.sql no aterrice, hermes_ro sigue con
    -- SELECT amplio vía el default privilege capturado en el baseline (ADR-D8).
    -- Se verifica el caso concreto que los MCP tools usan hoy (products); T-016
    -- extiende este check a la allowlist explícita una vez 0002 aterrice.
    IF NOT has_table_privilege('hermes_ro', 'public.products', 'SELECT') THEN
        RAISE EXCEPTION 'FALLO: hermes_ro no tiene SELECT en products';
    END IF;

    RAISE NOTICE 'check duro OK: rol hermes_ro presente con atributos y grants esperados';
END
$$;
SQL

echo "[setup-db-role] check duro OK: rol hermes_ro correcto"
echo "[setup-db-role] Nota: las passwords se provisionan out-of-band (ver RESTORE_RUNBOOK.md), este script no las rota ni las lee."
echo "[setup-db-role] listo (solo verificación, sin DDL)."
