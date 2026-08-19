--
-- 0002_hermes_least_privilege.down.sql
--
-- SDD artifacts live at ../../../openspec/changes/consolidado-web-2027/ (outside this repo,
-- see R2-003).
--
-- Rollback for 0002_hermes_least_privilege.sql (ADR-D5 `.down.sql` convention). Restores the
-- pre-0002 `hermes_ro` posture exactly as `0000_baseline.sql` captured it: both default-privilege
-- entries plus SELECT on all 14 relations the role held before the revoke.
--
-- Derived from `0000_baseline.sql` (grant section, lines 3003–3560; default privileges, lines
-- 3634 and 3645), hand-verified at authoring time (2026-08-18). `0001_m1_grants_rls.sql` does not
-- change any `hermes_ro` table grant, so baseline is the correct pre-0002 source of truth.
--
-- SECURITY note, not a data-loss note: this rollback deliberately re-opens the exposure H2
-- closes. It re-grants SELECT on `coupon_usage`, `shipping_usage`,
-- `order_communications` and `admin_users`, and — more importantly — reinstates the default
-- privilege, so every table created while this rollback is in effect becomes agent-readable at
-- creation time with no migration line to review. Do not leave the chain parked here: if 0002 is
-- rolled back, the `lint-chain.sh` ordering constraint no longer protects anything, and no new
-- table may be created until 0002 is re-applied.
--
-- GRANTOR: the `FOR ROLE` clauses below must mirror 0002's REVOKEs (and therefore baseline's
-- original GRANTs) — see the 0002 header. Same execution-role requirement: superuser, or a role
-- holding membership in both `postgres` and `supabase_admin`.
--
-- Idempotent: GRANT and ALTER DEFAULT PRIVILEGES ... GRANT are both no-ops when the privilege is
-- already present, so a re-run is safe.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- ---- default privileges (both grantors, as captured in baseline) ----
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES TO hermes_ro;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT ON TABLES TO hermes_ro;

-- ---- the 8 allowlisted relations 0002 kept (re-granted for completeness / partial-state replay) ----
GRANT SELECT ON TABLE public.products TO hermes_ro;
GRANT SELECT ON TABLE public.categories TO hermes_ro;
GRANT SELECT ON TABLE public.products_with_categories TO hermes_ro;
GRANT SELECT ON TABLE public.orders TO hermes_ro;
GRANT SELECT ON TABLE public.order_summary TO hermes_ro;
GRANT SELECT ON TABLE public.user_profiles TO hermes_ro;
GRANT SELECT ON TABLE public.shipping_methods TO hermes_ro;
GRANT SELECT ON TABLE public.coupons TO hermes_ro;

-- ---- the 6 relations 0002 revoked (four off-allowlist from the ADR-D8 table, plus the two
-- dead "own state" grants dropped per T-014f/F-3) ----
GRANT SELECT ON TABLE public.admin_users TO hermes_ro;
GRANT SELECT ON TABLE public.coupon_usage TO hermes_ro;
GRANT SELECT ON TABLE public.order_communications TO hermes_ro;
GRANT SELECT ON TABLE public.shipping_usage TO hermes_ro;
GRANT SELECT ON TABLE public.hermes_notifications TO hermes_ro;
GRANT SELECT ON TABLE public.hermes_pending_writes TO hermes_ro;

COMMIT;
