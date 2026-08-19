--
-- 0001_m1_grants_rls.sql — grants/RLS closure (M1, grants-rls-closure/spec.md)
--
-- SDD artifacts (design.md, specs/*, audits/, rehearsals/) live at the mhans workspace root:
-- ../../../openspec/changes/consolidado-web-2027/ (OUTSIDE this repo — not visible from a
-- clone of `dashboard/` alone; see R2-003).
--
-- Closes the live exposure where `anon` AND `authenticated` hold INSERT/UPDATE/DELETE/TRUNCATE
-- on 8 tables with no RLS. Snapshot of pre-change grants: _snapshot_0001_pre_revoke.sql (T-012,
-- extended for `authenticated` per R1-001 — see openspec audits/authenticated-write-paths.md).
--
-- IMPORTANT — this migration does more than a bare REVOKE, because enabling RLS on a table with
-- an incomplete policy set silently returns ZERO ROWS to every non-bypass role for EVERY
-- operation, not just the revoked ones (documented gotcha in
-- .claude/rules/02-database-schema.md: "GRANT sin policy RLS = 0 filas devueltas SIN error").
-- Roles that are NOT superuser and do NOT have BYPASSRLS, verified 2026-08-18:
--   * `anon` / `authenticated` (rolbypassrls=false) — the public site and logged-in customers.
--   * `hermes_ro` / `hermes_rw` / `hermes_notifier` (rolbypassrls=false) — the Telegram agent,
--     which reads/writes several of these 8 tables via direct SQL (not through PostgREST).
-- `service_role` has rolbypassrls=true (dashboard's supabaseAdmin), so it is unaffected by
-- every ENABLE ROW LEVEL SECURITY statement below and needs no policy.
--
-- R1-001 fix: `authenticated` originally kept the exact same over-broad grant `anon` had —
-- confirmed live against production (read-only) that `has_table_privilege('authenticated', ...)`
-- was `true` for all 32 (table x privilege) combinations, identical to the pre-migration `anon`
-- state. `openspec/.../audits/authenticated-write-paths.md` re-audits every write call site
-- (same browser client, `anon` vs `authenticated` differ only by JWT) and finds exactly two
-- legitimate authenticated writes: INSERT/UPDATE on `orders`, INSERT/UPDATE/DELETE on
-- `order_communications`, both ownership-scoped. TRUNCATE is revoked from `authenticated`
-- unconditionally on all 8 tables — RLS does not restrict TRUNCATE at all (it is table-level,
-- not row-level), so leaving that grant would defeat row-level protection regardless of policy
-- correctness, mirroring the exact reason the spec names TRUNCATE for the `anon` revoke.
--
-- R4-002 fix: lock/statement timeouts so `ENABLE ROW LEVEL SECURITY` (which takes an ACCESS
-- EXCLUSIVE lock) fails fast and lets the operator retry instead of queuing behind a long-lived
-- Hermes/PostgREST connection and stalling all `orders` traffic FIFO-behind it. See
-- `RESTORE_RUNBOOK.md` "Production apply procedure" for the retry loop and maintenance-window
-- expectations this timeout assumes.
--
-- R3-004 fix: every CREATE POLICY is preceded by DROP POLICY IF EXISTS, so a replay (e.g. after
-- a partial failure this transaction itself would have rolled back, or a deliberate re-run)
-- does not hard-fail on "policy already exists".
--
-- T-014d fix (audits/view-rls-bypass.md): enabling RLS on the base tables above is NOT sufficient,
-- because `order_summary` and `products_with_categories` are views owned by `supabase_admin`
-- (superuser, BYPASSRLS) with no `security_invoker` option. Under PostgreSQL 15 that means
-- security-DEFINER semantics: every permission and RLS check against the underlying tables is
-- evaluated as the view OWNER, not the caller. So any role holding SELECT on the view reads the
-- base tables with RLS switched off. The view section at the end of this migration closes that.
--
-- T-014f/F-1 fix (audits/rls-impact-hermes-worker.md): `coupons` gains an explicit Hermes read
-- policy. ADR-D8 recorded `coupons` as unreferenced by the MCP tools; that was wrong —
-- `_fetch_coupon` (`hermes-mhans/rental-mcp/rental_mcp/server.py:113-119`) reads it as `hermes_ro`
-- behind both the `quote` tool and `draft_create_order`. See the coupons section below.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- =========================================================================
-- orders — public-facing writes must move to authenticated + ownership;
-- Hermes direct-SQL access (hermes_rw writes, hermes_ro/hermes_notifier reads)
-- must be preserved via policy since neither role bypasses RLS.
-- =========================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.orders FROM anon;
REVOKE DELETE, TRUNCATE ON public.orders FROM authenticated;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can read their own orders" ON public.orders;
CREATE POLICY "Customers can read their own orders"
    ON public.orders
    FOR SELECT
    TO authenticated
    USING (
        customer_id IN (SELECT user_id FROM public.user_profiles WHERE auth_uid = auth.uid())
    );

DROP POLICY IF EXISTS "Customers can create their own orders" ON public.orders;
CREATE POLICY "Customers can create their own orders"
    ON public.orders
    FOR INSERT
    TO authenticated
    WITH CHECK (
        customer_id IN (SELECT user_id FROM public.user_profiles WHERE auth_uid = auth.uid())
    );

DROP POLICY IF EXISTS "Customers can update their own orders" ON public.orders;
CREATE POLICY "Customers can update their own orders"
    ON public.orders
    FOR UPDATE
    TO authenticated
    USING (
        customer_id IN (SELECT user_id FROM public.user_profiles WHERE auth_uid = auth.uid())
    )
    WITH CHECK (
        customer_id IN (SELECT user_id FROM public.user_profiles WHERE auth_uid = auth.uid())
    );

DROP POLICY IF EXISTS "Hermes agents can read orders" ON public.orders;
CREATE POLICY "Hermes agents can read orders"
    ON public.orders
    FOR SELECT
    TO hermes_ro, hermes_rw, hermes_notifier
    USING (true);

DROP POLICY IF EXISTS "hermes_rw can write orders" ON public.orders;
CREATE POLICY "hermes_rw can write orders"
    ON public.orders
    FOR INSERT
    TO hermes_rw
    WITH CHECK (true);

DROP POLICY IF EXISTS "hermes_rw can update orders" ON public.orders;
CREATE POLICY "hermes_rw can update orders"
    ON public.orders
    FOR UPDATE
    TO hermes_rw
    USING (true)
    WITH CHECK (true);

-- =========================================================================
-- products / categories — public catalogue read must remain open to anon;
-- write was never a legitimate anon OR authenticated path (dashboard writes
-- via service_role, which bypasses RLS entirely). hermes_ro keeps its read
-- for pricing tools.
-- =========================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.products FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.products FROM authenticated;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read products" ON public.products;
CREATE POLICY "Anyone can read products"
    ON public.products
    FOR SELECT
    USING (true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.categories FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.categories FROM authenticated;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read categories" ON public.categories;
CREATE POLICY "Anyone can read categories"
    ON public.categories
    FOR SELECT
    USING (true);

-- =========================================================================
-- coupons — already has "Anyone can read active coupons" and "Only admins can
-- manage coupons" policies (dormant until now, RLS was disabled). Revoke anon
-- AND authenticated write, turn RLS on; existing policies now take effect
-- unchanged.
--
-- T-014f/F-1: the surviving "Anyone can read active coupons" policy is
-- `TO PUBLIC USING (status = 'publish')`, so relying on it for Hermes would
-- make every draft/trash coupon vanish from the agent's view. `_quote_internal`
-- (server.py:173-190) validates a coupon on `date_expires`, `usage_limit` and
-- `usage_count` but NEVER on `status`, so today the agent quotes non-publish
-- coupons; a publish-only filter would silently change that into
-- "Cupón no encontrado" — a wrong answer, not an error. This policy is
-- `USING (true)` to preserve the current answer exactly. Whether the agent
-- SHOULD honour a trashed coupon is an application-logic question for
-- `_quote_internal`, not something a privilege migration may decide silently.
-- =========================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.coupons FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.coupons FROM authenticated;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hermes agents can read coupons" ON public.coupons;
CREATE POLICY "Hermes agents can read coupons"
    ON public.coupons
    FOR SELECT
    TO hermes_ro, hermes_rw
    USING (true);

-- =========================================================================
-- shipping_methods — already has "Anyone can read active shipping methods"
-- (dormant until now). Revoke anon AND authenticated write, turn RLS on, add
-- the Hermes read policy the quoting tool needs (per ADR-D8 allowlist).
-- =========================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.shipping_methods FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.shipping_methods FROM authenticated;
ALTER TABLE public.shipping_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hermes agents can read shipping methods" ON public.shipping_methods;
CREATE POLICY "Hermes agents can read shipping methods"
    ON public.shipping_methods
    FOR SELECT
    TO hermes_ro, hermes_rw, hermes_notifier
    USING (true);

-- =========================================================================
-- order_communications — DROP the residual `allow_all_for_testing` policy
-- (ALL / public — found during T-011 audit, would otherwise coexist with the
-- new policies below and defeat them). Customer chat must be ownership-scoped
-- to the order they belong to. Authenticated customers legitimately need
-- INSERT/UPDATE/DELETE here (R1-001 audit) — DELETE covers a customer
-- retracting their own message.
-- =========================================================================
DROP POLICY IF EXISTS allow_all_for_testing ON public.order_communications;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.order_communications FROM anon;
REVOKE TRUNCATE ON public.order_communications FROM authenticated;
ALTER TABLE public.order_communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can read their own order communications" ON public.order_communications;
CREATE POLICY "Customers can read their own order communications"
    ON public.order_communications
    FOR SELECT
    TO authenticated
    USING (
        order_id IN (
            SELECT o.id FROM public.orders o
            JOIN public.user_profiles up ON up.user_id = o.customer_id
            WHERE up.auth_uid = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Customers can write their own order communications" ON public.order_communications;
CREATE POLICY "Customers can write their own order communications"
    ON public.order_communications
    FOR INSERT
    TO authenticated
    WITH CHECK (
        order_id IN (
            SELECT o.id FROM public.orders o
            JOIN public.user_profiles up ON up.user_id = o.customer_id
            WHERE up.auth_uid = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Customers can mark their own order communications read" ON public.order_communications;
CREATE POLICY "Customers can mark their own order communications read"
    ON public.order_communications
    FOR UPDATE
    TO authenticated
    USING (
        order_id IN (
            SELECT o.id FROM public.orders o
            JOIN public.user_profiles up ON up.user_id = o.customer_id
            WHERE up.auth_uid = auth.uid()
        )
    )
    WITH CHECK (
        order_id IN (
            SELECT o.id FROM public.orders o
            JOIN public.user_profiles up ON up.user_id = o.customer_id
            WHERE up.auth_uid = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Customers can delete their own order communications" ON public.order_communications;
CREATE POLICY "Customers can delete their own order communications"
    ON public.order_communications
    FOR DELETE
    TO authenticated
    USING (
        order_id IN (
            SELECT o.id FROM public.orders o
            JOIN public.user_profiles up ON up.user_id = o.customer_id
            WHERE up.auth_uid = auth.uid()
        )
    );

-- =========================================================================
-- hermes_notifications — the outbox. No anon/authenticated access is
-- legitimate (T-011/R1-001: no code path). Only hermes_notifier (SELECT+
-- UPDATE, its existing table grant) needs a policy; the trigger's INSERT runs
-- SECURITY DEFINER as `supabase_admin`, which is superuser and bypasses RLS
-- entirely, so it needs no policy of its own.
-- =========================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.hermes_notifications FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.hermes_notifications FROM authenticated;
ALTER TABLE public.hermes_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hermes_notifier can read and update the outbox" ON public.hermes_notifications;
CREATE POLICY "hermes_notifier can read and update the outbox"
    ON public.hermes_notifications
    FOR SELECT
    TO hermes_notifier
    USING (true);

DROP POLICY IF EXISTS "hermes_notifier can mark notifications sent" ON public.hermes_notifications;
CREATE POLICY "hermes_notifier can mark notifications sent"
    ON public.hermes_notifications
    FOR UPDATE
    TO hermes_notifier
    USING (true)
    WITH CHECK (true);

-- =========================================================================
-- hermes_pending_writes — draft-confirm queue. Only hermes_rw uses it
-- (SELECT/INSERT/UPDATE, its existing table grant, per the human-approval
-- confirm_write pattern in hermes-agent-compatibility/spec.md). No
-- anon/authenticated access is legitimate (R1-001).
-- =========================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.hermes_pending_writes FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.hermes_pending_writes FROM authenticated;
ALTER TABLE public.hermes_pending_writes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hermes_rw can manage its own pending writes" ON public.hermes_pending_writes;
CREATE POLICY "hermes_rw can manage its own pending writes"
    ON public.hermes_pending_writes
    FOR ALL
    TO hermes_rw
    USING (true)
    WITH CHECK (true);

-- =========================================================================
-- VIEWS — close the security-definer bypass (T-014d, audits/view-rls-bypass.md).
--
-- Verified live 2026-08-18 via the read-only `mhans-db` MCP: both relations are `relkind='v'`,
-- owned by `supabase_admin` (superuser + BYPASSRLS), `reloptions IS NULL` (no security_invoker),
-- on server 15.8 — and BOTH `anon` AND `authenticated` hold SELECT on both. The audit named only
-- `anon`; `authenticated` is the same hole with a JWT attached, and is closed here too.
--
-- `order_summary` = `orders LEFT JOIN user_profiles`; it exposes billing_email, profile_rut,
-- customer_name and full financials for all 468 orders. Two independent fixes are applied, because
-- either one alone leaves a gap: `security_invoker` makes RLS apply to the caller but still lets a
-- future policy widen the view by accident, and a bare REVOKE leaves the definer semantics in place
-- for any role that is granted SELECT later.
--
-- Consumer evidence for the REVOKE (grep across dashboard-worktrees/consolidado,
-- frontend-worktrees/consolidado and hermes-mhans, 2026-08-18): `order_summary` has NO application
-- consumer at all. The only hits are `hermes-mhans/scripts/assert-least-privilege.sh` (the
-- allowlist assertion) and a prose mention in `hermes-mhans/skills/rental/catalogo/SKILL.md`. The
-- dashboard reads `orders` directly through `supabaseAdmin` (`service_role`, BYPASSRLS —
-- unaffected by either statement), and the frontend's only match is the historical DDL in
-- `src/utils/users_and_order_tables.sql` that created the view. Nothing anonymous or authenticated
-- reads it, so revoking breaks no caller.
--
-- `hermes_ro` KEEPS its SELECT (0002 allowlist) and keeps working under security_invoker: it needs
-- caller-side privilege plus a policy on each base table, and it has both — SELECT grants on
-- `orders` and `user_profiles` (0002 allowlist), the "Hermes agents can read orders" policy above,
-- and the baseline "Hermes agents can read user_profiles" policy (verified live: roles
-- {hermes_notifier,hermes_ro,hermes_rw}, USING true).
--
-- `products_with_categories` = `products LEFT JOIN LATERAL categories WHERE status='publish'`.
-- Its `anon` SELECT is KEPT: the catalogue is public by design and is the frontend's read path.
-- Only `security_invoker` is set, and that is behaviour-neutral here because both base tables
-- carry `USING (true)` SELECT policies ("Anyone can read products"/"Anyone can read categories",
-- created above) and `anon`/`authenticated`/`hermes_ro` all retain base-table SELECT (verified
-- live). Setting it removes the definer property from the whole class rather than leaving one
-- view that would silently re-open the hole the day someone adds a PII column to `products`.
-- =========================================================================
ALTER VIEW public.order_summary SET (security_invoker = on);
REVOKE SELECT ON public.order_summary FROM anon;
REVOKE SELECT ON public.order_summary FROM authenticated;

ALTER VIEW public.products_with_categories SET (security_invoker = on);

COMMIT;
