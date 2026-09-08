#!/usr/bin/env bash
#
# assert-serialised-assets-isolation.sh — T-034 runtime acceptance.
#
# Asserts that `public.serialised_assets`, the first table created after
# `dashboard/supabase/migrations/0002_hermes_least_privilege.sql`, is NOT readable by the Telegram
# agent's role. This is the first real exercise of hermes-agent-compatibility/spec.md — "A newly
# created table is not agent-readable by default" — against an actual database rather than a
# reviewed diff.
#
# ISSUES NO DDL — query-only, exits non-zero on drift (same contract as assert-least-privilege.sh).
#
# Three checks, all merge/deploy blocking:
#   1. hermes_ro has no SELECT on the table. A `true` here means 0002's default-privilege
#      revocation did not take effect for the grantor that owns this table — the exact silent
#      failure 0002 exists to prevent, and one that no code review of 0004 could have caught,
#      because 0004 contains no grant line at all.
#   2. Neither `anon` nor `authenticated` holds any privilege. Supabase's defaults hand these
#      roles a working surface on new tables in `public`; 0004 revokes them explicitly.
#   3. RLS is enabled.
#
# `has_table_privilege` is the right instrument for check 1 (unlike the allowlist comparison in
# assert-least-privilege.sh, which answers a different question): it resolves privileges through
# role membership and PUBLIC grants, so it cannot be fooled by a grant made to a role hermes_ro
# inherits rather than to hermes_ro itself.
#
# Complements, does not replace, assert-least-privilege.sh: that script would also catch this
# table appearing as an off-allowlist "extra", but only while the allowlist stays exact. This one
# names the table, so it keeps failing for the right reason if the allowlist is ever widened.
#
# Default target is production (the runbooks reference these values). Env-overridable so a staging
# or rehearsal-restore run needs no sed-patched copy of this script.
set -euo pipefail

DB_CONTAINER=${DB_CONTAINER:-supabase-9cd8-db}
DB_NET=${DB_NET:-rental-pre0225supabase-sssmcr}
DB_PORT=${DB_PORT:-5434}

PGPW=$(docker inspect "$DB_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -oP '^POSTGRES_PASSWORD=\K.*')

echo "[assert-serialised-assets-isolation] Checking hermes_ro / anon isolation on serialised_assets ..."

docker run --rm -i --network "$DB_NET" -e PGPASSWORD="$PGPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
    rls_enabled boolean;
BEGIN
    IF to_regclass('public.serialised_assets') IS NULL THEN
        RAISE EXCEPTION 'FAIL: table public.serialised_assets does not exist — 0004 was not applied';
    END IF;

    -- ---- check 1: the agent role cannot read the table (T-034 acceptance) ----
    IF has_table_privilege('hermes_ro', 'public.serialised_assets', 'SELECT') THEN
        RAISE EXCEPTION 'FAIL: hermes_ro has SELECT on public.serialised_assets. Either 0002 did '
                        'not revoke the default privilege for this table''s grantor, or a grant '
                        'was added without an ADR-D8 allowlist change.';
    END IF;

    -- ---- check 2: no browser-reachable role holds anything ----
    IF has_table_privilege('anon', 'public.serialised_assets', 'SELECT')
       OR has_table_privilege('anon', 'public.serialised_assets', 'INSERT')
       OR has_table_privilege('authenticated', 'public.serialised_assets', 'SELECT')
       OR has_table_privilege('authenticated', 'public.serialised_assets', 'INSERT') THEN
        RAISE EXCEPTION 'FAIL: anon or authenticated holds privileges on public.serialised_assets. '
                        'Serial numbers and equipment locations are admin-only.';
    END IF;

    -- ---- check 3: RLS on ----
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class WHERE oid = 'public.serialised_assets'::regclass;

    IF NOT rls_enabled THEN
        RAISE EXCEPTION 'FAIL: row level security is disabled on public.serialised_assets';
    END IF;

    RAISE NOTICE 'hard check OK: serialised_assets invisible to hermes_ro, anon and authenticated; RLS enabled';
END
$$;
SQL

echo "[assert-serialised-assets-isolation] hard check OK: new table is not agent-readable"
