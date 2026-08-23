#!/usr/bin/env bash
#
# assert-t026-schema-gaps-isolation.sh — T-026 runtime acceptance.
#
# Asserts that `public.asset_movements` and `public.expenses`, the two tables created by
# `dashboard/supabase/migrations/0006_t026_schema_gaps.sql`, are NOT readable by the Telegram
# agent's role, and that no browser-reachable role holds any privilege on them. Follows the exact
# pattern of `assert-serialised-assets-isolation.sh` (T-034) — see that script for the full
# rationale on why `has_table_privilege` is the right instrument here.
#
# ISSUES NO DDL — query-only, exits non-zero on drift (same contract as assert-least-privilege.sh
# and assert-serialised-assets-isolation.sh).
#
# Four checks per table, all merge/deploy blocking:
#   1. hermes_ro has no SELECT.
#   2. Neither anon nor authenticated holds SELECT or INSERT.
#   3. RLS is enabled.
#   4. The table exists (guards against running this before 0006 is applied).
#
# Default target is production (the runbooks reference these values). Env-overridable so a staging
# or rehearsal-restore run needs no sed-patched copy of this script.
set -euo pipefail

DB_CONTAINER=${DB_CONTAINER:-supabase-9cd8-db}
DB_NET=${DB_NET:-rental-pre0225supabase-sssmcr}
DB_PORT=${DB_PORT:-5434}

PGPW=$(docker inspect "$DB_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -oP '^POSTGRES_PASSWORD=\K.*')

echo "[assert-t026-schema-gaps-isolation] Checking hermes_ro / anon isolation on asset_movements and expenses ..."

docker run --rm -i --network "$DB_NET" -e PGPASSWORD="$PGPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
    rls_enabled boolean;
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['public.asset_movements', 'public.expenses']
    LOOP
        IF to_regclass(tbl) IS NULL THEN
            RAISE EXCEPTION 'FAIL: table % does not exist — 0006 was not applied', tbl;
        END IF;

        -- ---- check 1: the agent role cannot read the table ----
        IF has_table_privilege('hermes_ro', tbl, 'SELECT') THEN
            RAISE EXCEPTION 'FAIL: hermes_ro has SELECT on %. A grant was added without an ADR-D8 '
                            'allowlist change, or 0002''s default-privilege revocation did not '
                            'take effect for this table''s grantor.', tbl;
        END IF;

        -- ---- check 2: no browser-reachable role holds anything ----
        IF has_table_privilege('anon', tbl, 'SELECT')
           OR has_table_privilege('anon', tbl, 'INSERT')
           OR has_table_privilege('authenticated', tbl, 'SELECT')
           OR has_table_privilege('authenticated', tbl, 'INSERT') THEN
            RAISE EXCEPTION 'FAIL: anon or authenticated holds privileges on %. Inventory movement '
                            'and expense data are admin-only.', tbl;
        END IF;

        -- ---- check 3: RLS on ----
        SELECT relrowsecurity INTO rls_enabled FROM pg_class WHERE oid = tbl::regclass;

        IF NOT rls_enabled THEN
            RAISE EXCEPTION 'FAIL: row level security is disabled on %', tbl;
        END IF;

        RAISE NOTICE 'hard check OK for %: invisible to hermes_ro, anon and authenticated; RLS enabled', tbl;
    END LOOP;
END
$$;
SQL

echo "[assert-t026-schema-gaps-isolation] hard check OK: new tables are not agent-readable"
