--
-- 0002_hermes_least_privilege.sql — hermes_ro default-privilege revocation (H2, ADR-D8,
-- hermes-agent-compatibility/spec.md "Default-privilege revocation precedes any new table")
--
-- SDD artifacts (design.md, specs/*, audits/, rehearsals/) live at the mhans workspace root:
-- ../../../openspec/changes/consolidado-web-2027/ (OUTSIDE this repo — not visible from a
-- clone of `dashboard/` alone; see R2-003).
--
-- Moves `hermes_ro` from "reads every table in `public`, forever, including tables that do not
-- exist yet" to an explicit 8-relation allowlist. The default privilege is the dangerous half:
-- `pg_default_acl` makes every FUTURE `CREATE TABLE` agent-readable at creation time, silently,
-- with no migration line to review. That is why this migration is a HARD ORDERING CONSTRAINT —
-- it must land before any migration that creates a new table (enforced by
-- `lint-chain.sh` and `hermes-mhans/scripts/assert-least-privilege.sh`).
--
-- GRANTOR — the single detail that makes or breaks this migration:
-- `ALTER DEFAULT PRIVILEGES` entries are keyed by (grantor role, schema, object type). A REVOKE
-- whose `FOR ROLE` clause does not match the grantor of the original GRANT removes NOTHING and
-- raises NO ERROR — it silently leaves the `pg_default_acl` row in place. `0000_baseline.sql`
-- captured TWO entries for `hermes_ro` (lines 3634 and 3645), one per grantor:
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres       IN SCHEMA public GRANT SELECT ON TABLES TO hermes_ro;
--   ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT ON TABLES TO hermes_ro;
-- Both are revoked below. Revoking only the `postgres` one would leave `supabase_admin`-owned
-- future tables agent-readable — the exact failure this migration exists to prevent.
--
-- EXECUTION ROLE: `ALTER DEFAULT PRIVILEGES FOR ROLE <r>` requires the executing role to BE `<r>`
-- or be a member of it. Apply this migration as a superuser (or as a role holding membership in
-- both `postgres` and `supabase_admin`); running it as plain `postgres` without `supabase_admin`
-- membership fails on the second statement with "must be a member of role". See
-- `RESTORE_RUNBOOK.md` for the connection role used by the apply procedure.
--
-- SCOPE — other roles are untouched by design. `REVOKE ... FROM hermes_ro` names exactly one
-- grantee, so `hermes_rw`'s writes (`orders`, `hermes_pending_writes`), `hermes_notifier`'s
-- SELECT+UPDATE on `hermes_notifications`, and every sequence grant survive unchanged. This
-- migration touches no privilege other than `hermes_ro`'s SELECT on tables in `public`.
--
-- INTERACTION WITH 0001: `0001_m1_grants_rls.sql` enabled RLS on `order_communications` without a
-- `hermes_ro` policy, so the agent already read zero rows from it (deny-by-default). Dropping the
-- grant here turns that silent empty result into an honest "permission denied", which is the
-- behaviour the assertion scripts can actually verify. The three `0001` policies naming
-- `hermes_ro` (`orders`, `shipping_methods`, `coupons`) and the baseline policy on `user_profiles`
-- all target allowlisted relations and keep working.
--
-- T-014f/F-1 (audits/rls-impact-hermes-worker.md) — `coupons` ADDED to the allowlist. The original
-- header asserted `coupons` was "not referenced by any of the 21 MCP tools", copied from the
-- ADR-D8 table. That assertion is FALSE: `_fetch_coupon`
-- (`hermes-mhans/rental-mcp/rental_mcp/server.py:113-119`) issues
-- `SELECT * FROM coupons WHERE code = %s` with no `pool=` argument, so it runs on the `ro` pool as
-- `hermes_ro`, and `_quote_internal` (server.py:174) calls it for both the `quote` tool and
-- `draft_create_order`. Without this grant every coupon-bearing quote raises "permission denied".
-- Chosen over routing `_fetch_coupon` through `pool="rw"`: that would widen the WRITE role's read
-- surface to satisfy a pure read (wrong direction for a least-privilege change), leave the
-- publish-only visibility bug of F-1 unfixed, and put a security fix in application code where the
-- assertion scripts cannot see it. `rehearsals/0002.md` recorded the denial as the EXPECTED result
-- and must be re-run.
--
-- T-014f/F-3 — `hermes_notifications` and `hermes_pending_writes` REMOVED from the allowlist. They
-- were granted "-- own state", but 0001's only policies on them are `TO hermes_notifier` and
-- `FOR ALL TO hermes_rw` respectively, so a `hermes_ro` read returned zero rows with NO error —
-- the documented trap in `.claude/rules/02-database-schema.md`. The audit's operation map confirms
-- no code path reads either as `hermes_ro` (all `hermes_pending_writes` access is `pool="rw"`;
-- the notifier uses its own DSN). Dropping the unused grants is preferred over adding policies to
-- prop up a capability nothing uses. Net: 9 relations - 2 + 1 = 8.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- =========================================================================
-- ROLE GUARD (prod-parity audit, 2026-08-19). Runs FIRST, inside the transaction.
--
-- Every relation in production's `public` schema is owned by `supabase_admin`, and the `postgres`
-- role there is NOT a superuser and NOT a member of `supabase_admin` (staging had it as superuser,
-- which is why the rehearsals passed and hid this). Executed as `postgres`, this migration:
--   * ALTER TABLE / ALTER VIEW / CREATE POLICY -> ERROR: must be owner of ...
--   * ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin -> ERROR: must be member of role ...
--   * REVOKE ... FROM anon -> returns the tag `REVOKE` with only `WARNING: no privileges could be
--     revoked`, changing nothing while psql exits 0.
--
-- That last one is the reason this guard exists: without it the wrong-role apply reports success
-- and leaves anon holding every privilege the migration claims to have removed.
--
-- Apply with:  psql -U supabase_admin -v ON_ERROR_STOP=1 -f <this file>
-- =========================================================================
DO $role_guard$
BEGIN
  IF NOT pg_has_role(current_user, 'supabase_admin', 'USAGE') THEN
    RAISE EXCEPTION
      'Esta migracion debe ejecutarse como supabase_admin (rol actual: %). Las relaciones de public '
      'pertenecen a supabase_admin: como postgres, REVOKE informa exito y no revoca nada.',
      current_user
      USING HINT = 'psql -U supabase_admin -v ON_ERROR_STOP=1 -f <archivo>';
  END IF;
END
$role_guard$;

-- =========================================================================
-- 1. Default privileges — the future-table exposure. Both grantors (see header).
-- =========================================================================
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE SELECT ON TABLES FROM hermes_ro;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE SELECT ON TABLES FROM hermes_ro;

-- =========================================================================
-- 2. Existing privileges — clear the whole surface, then re-grant the allowlist.
-- `ALL TABLES` covers views too (`order_summary`, `products_with_categories`), which is why
-- both appear in the re-grant list below.
-- =========================================================================
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM hermes_ro;

-- =========================================================================
-- 3. Re-grant the ADR-D8 allowlist — exactly 8 relations, nothing else. Every line here is a
-- relation a call site in `rental-mcp` actually reads as `hermes_ro`, and every one is backed by a
-- policy naming `hermes_ro` (or a PUBLIC `USING (true)` one) — grant and policy must both exist or
-- the read is a silent zero-row result.
-- Deliberately NOT re-granted, no `hermes_ro` call site: coupon_usage, shipping_usage,
-- order_communications, admin_users, hermes_notifications, hermes_pending_writes (see F-3 above).
-- =========================================================================
GRANT SELECT ON TABLE public.products TO hermes_ro;                  -- pricing / availability tools
GRANT SELECT ON TABLE public.categories TO hermes_ro;                -- pricing / availability tools
GRANT SELECT ON TABLE public.products_with_categories TO hermes_ro;  -- pricing / availability tools (view)
GRANT SELECT ON TABLE public.orders TO hermes_ro;                    -- list_orders, get_order_status
GRANT SELECT ON TABLE public.order_summary TO hermes_ro;             -- list_orders, get_order_status (view)
GRANT SELECT ON TABLE public.user_profiles TO hermes_ro;             -- client lookup (RLS-gated by the Hermes policy)
GRANT SELECT ON TABLE public.shipping_methods TO hermes_ro;          -- quoting
GRANT SELECT ON TABLE public.coupons TO hermes_ro;                   -- _fetch_coupon -> quote, draft_create_order (F-1)

COMMIT;

-- =========================================================================
-- Post-apply assertion (test-first artifact, T-015). Non-empty result = FAIL — the default
-- privilege survived, almost certainly a grantor mismatch. This query is the core of
-- `hermes-mhans/scripts/assert-least-privilege.sh` (T-016).
--
--   SELECT pg_get_userbyid(d.defaclrole) AS grantor,
--          n.nspname                     AS schema,
--          d.defaclobjtype               AS objtype,
--          d.defaclacl::text             AS acl
--   FROM pg_default_acl d
--   JOIN pg_namespace n ON n.oid = d.defaclnamespace
--   WHERE array_to_string(d.defaclacl, ',') LIKE '%hermes_ro=%';
--
-- Before this migration it returns 2 rows (grantors `postgres` and `supabase_admin`); after,
-- it MUST return 0.
-- =========================================================================
