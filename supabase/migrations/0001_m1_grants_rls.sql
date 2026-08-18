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
-- =========================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.coupons FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.coupons FROM authenticated;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

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

COMMIT;
