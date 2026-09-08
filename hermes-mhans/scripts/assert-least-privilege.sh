#!/usr/bin/env bash
# Asserts the hermes_ro least-privilege posture established by
# dashboard/supabase/migrations/0002_hermes_least_privilege.sql (H2, ADR-D8).
# ISSUES NO DDL — query-only, exits non-zero on drift (same contract as the T-006 scripts).
#
# Two checks, both merge/deploy blocking:
#   1. pg_default_acl contains NO entry granting to hermes_ro. A surviving entry means every
#      FUTURE `CREATE TABLE` in `public` is agent-readable at creation time, silently. The most
#      likely cause of a survivor is a GRANTOR MISMATCH: `ALTER DEFAULT PRIVILEGES` rows are keyed
#      by (grantor, schema, objtype), and a REVOKE with the wrong `FOR ROLE` removes nothing and
#      raises no error. Baseline captured two grantors (`postgres`, `supabase_admin`); 0002
#      revokes both.
#   2. hermes_ro's SELECT grants in `public` equal the 8-relation ADR-D8 allowlist EXACTLY —
#      no extras (privilege creep / a new table that slipped in before 0002) and none missing
#      (the agent's 21 MCP tools would break).
#
# Allowlist revised 2026-08-18 by T-014f (openspec audits/rls-impact-hermes-worker.md):
# `coupons` ADDED (F-1 — `_fetch_coupon` reads it as hermes_ro behind `quote` and
# `draft_create_order`; the original ADR-D8 table wrongly listed it as unreferenced), and
# `hermes_notifications` + `hermes_pending_writes` REMOVED (F-3 — granted but with no policy
# naming hermes_ro, so they returned zero rows with no error, and no call site reads them as
# hermes_ro anyway). 9 - 2 + 1 = 8.
#
# Why aclexplode(pg_class.relacl) and not information_schema.role_table_grants: that view only
# exposes rows whose grantor OR grantee is a currently-enabled role. This script connects as
# `postgres`, not as hermes_ro, so the view's contents depend on who happened to issue the
# original GRANT — a false PASS waiting to happen. The catalog is grantee-keyed and unfiltered.
set -euo pipefail

# Default target is production (the runbooks reference these values). Env-overridable so a
# staging or rehearsal-restore run needs no sed-patched copy of this script.
DB_CONTAINER=${DB_CONTAINER:-supabase-9cd8-db}
DB_NET=${DB_NET:-rental-pre0225supabase-sssmcr}
DB_PORT=${DB_PORT:-5434}

PGPW=$(docker inspect "$DB_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -oP '^POSTGRES_PASSWORD=\K.*')

echo "[assert-least-privilege] Checking hermes_ro default privileges and SELECT allowlist ..."

docker run --rm -i --network "$DB_NET" -e PGPASSWORD="$PGPW" postgres:16-alpine \
  psql -h "$DB_CONTAINER" -p "$DB_PORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
    -- ADR-D8 allowlist, sorted. Any change here needs a migration line, not an edit to this file.
    expected  text[] := ARRAY[
        'categories',
        'coupons',
        'order_summary',
        'orders',
        'products',
        'products_with_categories',
        'shipping_methods',
        'user_profiles'
    ];
    ro_oid    oid;
    actual    text[];
    extra     text[];
    missing   text[];
    dacl_rows text;
BEGIN
    SELECT oid INTO ro_oid FROM pg_roles WHERE rolname = 'hermes_ro';
    IF ro_oid IS NULL THEN
        RAISE EXCEPTION 'FAIL: role hermes_ro does not exist (expected by 0000_baseline.sql)';
    END IF;

    -- ---- check 1: no default privilege entry for hermes_ro ----
    SELECT string_agg(
               format('grantor=%s schema=%s objtype=%s',
                      pg_get_userbyid(d.defaclrole), n.nspname, d.defaclobjtype),
               '; ' ORDER BY n.nspname)
      INTO dacl_rows
    FROM pg_default_acl d
    JOIN pg_namespace n ON n.oid = d.defaclnamespace
    CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    WHERE a.grantee = ro_oid;

    IF dacl_rows IS NOT NULL THEN
        RAISE EXCEPTION 'FAIL: pg_default_acl still grants to hermes_ro (%). 0002 did not take '
                        'effect for every grantor — check the FOR ROLE clauses.', dacl_rows;
    END IF;

    -- ---- check 2: SELECT grants equal the allowlist exactly ----
    SELECT coalesce(array_agg(DISTINCT c.relname::text ORDER BY c.relname::text), ARRAY[]::text[])
      INTO actual
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'v', 'm', 'p', 'f')
      AND a.grantee = ro_oid
      AND a.privilege_type = 'SELECT';

    SELECT coalesce(array_agg(x ORDER BY x), ARRAY[]::text[]) INTO extra
    FROM unnest(actual) x WHERE x <> ALL (expected);

    SELECT coalesce(array_agg(x ORDER BY x), ARRAY[]::text[]) INTO missing
    FROM unnest(expected) x WHERE x <> ALL (actual);

    IF array_length(extra, 1) IS NOT NULL THEN
        RAISE EXCEPTION 'FAIL: hermes_ro has SELECT on off-allowlist relation(s): %. '
                        'Either 0002 was not applied, or a later migration granted access '
                        'without review.', array_to_string(extra, ', ');
    END IF;

    IF array_length(missing, 1) IS NOT NULL THEN
        RAISE EXCEPTION 'FAIL: hermes_ro is MISSING SELECT on allowlisted relation(s): %. '
                        'The agent''s MCP tools will fail.', array_to_string(missing, ', ');
    END IF;

    RAISE NOTICE 'hard check OK: pg_default_acl clean for hermes_ro; SELECT allowlist matches (% relations)',
                 array_length(actual, 1);
END
$$;
SQL

echo "[assert-least-privilege] hard check OK: default privileges revoked, allowlist exact"

# Smoke: an off-allowlist read must be denied outright, not silently empty. `postgres` is not a
# member of hermes_ro (`SET ROLE` gives "permission denied" — confirmed in T-006), so this uses
# the hermes_ro DSN already provisioned out-of-band (see RESTORE_RUNBOOK.md). This script only
# READS that DSN; it never generates or rotates it.
ENV_FILE=${ENV_FILE:-/opt/agents/mhans/.env}
if [ ! -f "$ENV_FILE" ] || ! grep -q '^DATABASE_URL=' "$ENV_FILE"; then
  echo "[assert-least-privilege] smoke skipped: $ENV_FILE has no provisioned DATABASE_URL (see RESTORE_RUNBOOK.md)"
else
  RO_URL=$(grep -m1 '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2-)

  # Allowlisted reads must still work. `coupons` is probed explicitly and separately: it is the
  # F-1 regression guard. A grant alone is not enough there — 0001's "Hermes agents can read
  # coupons" policy must also exist, or this returns zero rows with no error and the `quote` tool
  # silently answers "Cupón no encontrado". Hence `count(*)`, not `SELECT 1 ... LIMIT 1`: the
  # latter cannot tell "denied by policy" from "table happens to be empty".
  for rel in orders coupons; do
    if ! docker run --rm --network "$DB_NET" postgres:16-alpine \
         psql "$RO_URL" -tAc "SELECT count(*) FROM public.$rel" >/dev/null 2>&1; then
      echo "[assert-least-privilege] FAIL smoke: hermes_ro cannot read public.$rel (allowlisted)"
      exit 1
    fi
  done

  # Off-allowlist read must be denied. Empty output is NOT a pass — RLS-denied and
  # privilege-denied look different and only the latter is what 0002 establishes. `admin_users` is
  # the probe target because it is off-allowlist and has no `hermes_ro` policy either, so a false
  # PASS cannot come from a policy quietly filtering the rows away.
  DENIED=$(docker run --rm --network "$DB_NET" postgres:16-alpine \
    psql "$RO_URL" -tAc "SELECT 1 FROM public.admin_users LIMIT 1" 2>&1 || true)

  case "$DENIED" in
    *"permission denied"*)
      echo "[assert-least-privilege] smoke OK: hermes_ro denied on public.admin_users, reads public.orders and public.coupons"
      ;;
    *)
      echo "[assert-least-privilege] FAIL smoke: expected 'permission denied' on public.admin_users, got: $DENIED"
      exit 1
      ;;
  esac
fi

echo "[assert-least-privilege] done (verification only, no DDL)."
