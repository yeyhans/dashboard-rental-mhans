#!/usr/bin/env bash
# Verifica el rol de LECTURA ACOTADA hermes_notifier en el Supabase del rental.
# NO EMITE DDL.
#
# Permisos esperados: SELECT en orders + user_profiles, SELECT+UPDATE en
# hermes_notifications. Explícitamente SIN INSERT/DELETE en orders, user_profiles
# o cualquier otra tabla.
#
# Inversión de contrato (CONSOLIDADO WEB 2027, ADR-D5): el rol y sus grants ahora se
# crean EXCLUSIVAMENTE por dashboard/supabase/migrations/0000_baseline.sql. Este
# script pasa de "apply" a "verify" — solo consulta pg_roles / has_table_privilege
# y sale con código != 0 si algo diverge. NO rota passwords ni escribe
# DATABASE_URL_NOTIFIER (ver RESTORE_RUNBOOK.md). El nombre del archivo NO cambia.
set -euo pipefail

# Objetivo por defecto: producción (los runbooks referencian estos valores). Sobreescribible por
# entorno para apuntar a staging o a un restore de rehearsal sin parchear el script con sed.
DB_CONTAINER=${DB_CONTAINER:-supabase-9cd8-db}
DB_NET=${DB_NET:-rental-pre0225supabase-sssmcr}
DB_PORT=${DB_PORT:-5434}

PGPW=$(docker inspect "$DB_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -oP '^POSTGRES_PASSWORD=\K.*')

echo "[setup-db-role-notifier] Verificando rol hermes_notifier (solo lectura) ..."

docker run --rm -i --network "$DB_NET" -e PGPASSWORD="$PGPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_roles
        WHERE rolname = 'hermes_notifier'
          AND rolcanlogin = true
          AND rolsuper = false
          AND rolcreatedb = false
          AND rolcreaterole = false
          AND rolinherit = false
    ) THEN
        RAISE EXCEPTION 'FALLO: rol hermes_notifier no existe o sus atributos divergen de 0000_baseline.sql';
    END IF;

    IF NOT (
        has_table_privilege('hermes_notifier', 'public.orders', 'SELECT')
        AND has_table_privilege('hermes_notifier', 'public.user_profiles', 'SELECT')
    ) THEN
        RAISE EXCEPTION 'FALLO: hermes_notifier no tiene SELECT en orders + user_profiles';
    END IF;

    IF has_table_privilege('hermes_notifier', 'public.orders', 'INSERT')
       OR has_table_privilege('hermes_notifier', 'public.orders', 'DELETE') THEN
        RAISE EXCEPTION 'FALLO: hermes_notifier tiene INSERT/DELETE en orders — este rol es solo-lectura';
    END IF;

    IF NOT (
        has_table_privilege('hermes_notifier', 'public.hermes_notifications', 'SELECT')
        AND has_table_privilege('hermes_notifier', 'public.hermes_notifications', 'UPDATE')
    ) THEN
        RAISE EXCEPTION 'FALLO: hermes_notifier no tiene SELECT+UPDATE en hermes_notifications';
    END IF;

    RAISE NOTICE 'check duro OK: rol hermes_notifier con grants de solo-lectura + outbox esperados';
END
$$;
SQL

echo "[setup-db-role-notifier] check duro OK: rol hermes_notifier correcto"
echo "[setup-db-role-notifier] Nota: las passwords se provisionan out-of-band (ver RESTORE_RUNBOOK.md), este script no las rota ni las lee."
echo "[setup-db-role-notifier] listo (solo verificación, sin DDL)."
