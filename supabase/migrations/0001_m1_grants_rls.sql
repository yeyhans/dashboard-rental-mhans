--
-- 0001_m1_grants_rls.sql — grants/RLS closure (M1, grants-rls-closure/spec.md)
--
-- Closes the live exposure where `anon` holds INSERT/UPDATE/DELETE/TRUNCATE on 8 tables with
-- no RLS. Snapshot of pre-change grants: 0001_pre_revoke_snapshot.sql (T-012).
--
-- IMPORTANT — this migration does more than the bare REVOKE the spec title suggests, because
-- enabling RLS on a table with an incomplete policy set silently returns ZERO ROWS to every
-- non-bypass role for EVERY operation, not just the revoked ones (documented gotcha in
-- .claude/rules/02-database-schema.md: "GRANT sin policy RLS = 0 filas devueltas SIN error").
-- Two consumer classes are NOT superuser and do NOT have BYPASSRLS, verified 2026-08-18:
--   * `anon` / `authenticated` (rolbypassrls=false) — the public site and logged-in customers.
--   * `hermes_ro` / `hermes_rw` / `hermes_notifier` (rolbypassrls=false) — the Telegram agent,
--     which reads/writes several of these 8 tables via direct SQL (not through PostgREST).
-- `service_role` has rolbypassrls=true (dashboard's supabaseAdmin), so it is unaffected by
-- every ENABLE ROW LEVEL SECURITY statement below and needs no policy.
-- Without Hermes-covering policies, this migration would silently break the agent the moment
-- it lands — mirroring the exact historical incident `setup-rls-hermes.sh` was written to fix
-- for `user_profiles` (see that script's header comment).
--
-- Anon-write audit this migration is based on: audits/anon-write-paths.md (T-011).
--

BEGIN;

-- =========================================================================
-- orders — public-facing writes must move to authenticated + ownership;
-- Hermes direct-SQL access (hermes_rw writes, hermes_ro/hermes_notifier reads)
-- must be preserved via policy since neither role bypasses RLS.
-- =========================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.orders FROM anon;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read their own orders"
    ON public.orders
    FOR SELECT
    TO authenticated
    USING (
        customer_id IN (SELECT user_id FROM public.user_profiles WHERE auth_uid = auth.uid())
    );

CREATE POLICY "Customers can create their own orders"
    ON public.orders
    FOR INSERT
    TO authenticated
    WITH CHECK (
        customer_id IN (SELECT user_id FROM public.user_profiles WHERE auth_uid = auth.uid())
    );

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

CREATE POLICY "Hermes agents can read orders"
    ON public.orders
    FOR SELECT
    TO hermes_ro, hermes_rw, hermes_notifier
    USING (true);

CREATE POLICY "hermes_rw can write orders"
    ON public.orders
    FOR INSERT
    TO hermes_rw
    WITH CHECK (true);

CREATE POLICY "hermes_rw can update orders"
    ON public.orders
    FOR UPDATE
    TO hermes_rw
    USING (true)
    WITH CHECK (true);

-- =========================================================================
-- products / categories — public catalogue read must remain open to anon;
-- write was never a legitimate anon path (dashboard writes via service_role,
-- which bypasses RLS entirely). hermes_ro keeps its read for pricing tools.
-- =========================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.products FROM anon;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read products"
    ON public.products
    FOR SELECT
    USING (true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.categories FROM anon;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read categories"
    ON public.categories
    FOR SELECT
    USING (true);

-- =========================================================================
-- coupons — already has "Anyone can read active coupons" and "Only admins can
-- manage coupons" policies (dormant until now, RLS was disabled). Just revoke
-- anon write and turn RLS on; existing policies now take effect unchanged.
-- =========================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.coupons FROM anon;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- shipping_methods — already has "Anyone can read active shipping methods"
-- (dormant until now). Revoke anon write, turn RLS on, add the Hermes read
-- policy the quoting tool needs (per ADR-D8 allowlist).
-- =========================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.shipping_methods FROM anon;
ALTER TABLE public.shipping_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hermes agents can read shipping methods"
    ON public.shipping_methods
    FOR SELECT
    TO hermes_ro, hermes_rw, hermes_notifier
    USING (true);

-- =========================================================================
-- order_communications — DROP the residual `allow_all_for_testing` policy
-- (ALL / public — found during T-011 audit, would otherwise coexist with the
-- new policy below and defeat it). Customer chat must be ownership-scoped to
-- the order they belong to.
-- =========================================================================
DROP POLICY IF EXISTS allow_all_for_testing ON public.order_communications;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.order_communications FROM anon;
ALTER TABLE public.order_communications ENABLE ROW LEVEL SECURITY;

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

-- =========================================================================
-- hermes_notifications — the outbox. No anon/authenticated access is
-- legitimate (T-011: no code path). Only hermes_notifier (SELECT+UPDATE, its
-- existing table grant) needs a policy; the trigger's INSERT runs
-- SECURITY DEFINER as `supabase_admin`, which is superuser and bypasses RLS
-- entirely, so it needs no policy of its own.
-- =========================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.hermes_notifications FROM anon;
ALTER TABLE public.hermes_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hermes_notifier can read and update the outbox"
    ON public.hermes_notifications
    FOR SELECT
    TO hermes_notifier
    USING (true);

CREATE POLICY "hermes_notifier can mark notifications sent"
    ON public.hermes_notifications
    FOR UPDATE
    TO hermes_notifier
    USING (true)
    WITH CHECK (true);

-- =========================================================================
-- hermes_pending_writes — draft-confirm queue. Only hermes_rw uses it
-- (SELECT/INSERT/UPDATE, its existing table grant, per the human-approval
-- confirm_write pattern in hermes-agent-compatibility/spec.md).
-- =========================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.hermes_pending_writes FROM anon;
ALTER TABLE public.hermes_pending_writes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hermes_rw can manage its own pending writes"
    ON public.hermes_pending_writes
    FOR ALL
    TO hermes_rw
    USING (true)
    WITH CHECK (true);

COMMIT;
