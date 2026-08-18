--
-- 0001_m1_grants_rls.down.sql
--
-- Rollback for 0001_m1_grants_rls.sql. Re-GRANT generated from
-- 0001_pre_revoke_snapshot.sql (T-012). Drops every policy this migration created and
-- restores the pre-migration state, including the residual `allow_all_for_testing` policy on
-- `order_communications` this migration removed (data-loss note below).
--
-- Data-loss note: dropping `allow_all_for_testing` is NOT reversible from schema state alone
-- if it was already gone before this migration ran on a given environment — this down script
-- recreates it verbatim (`USING (true) WITH CHECK (true)`, matching the pre-migration
-- definition captured during T-011/T-012) so a rollback restores the exact pre-migration
-- posture, intentionally including that pre-existing test-only policy's over-broad grant.
--

BEGIN;

-- ---- orders ----
DROP POLICY IF EXISTS "Customers can read their own orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can update their own orders" ON public.orders;
DROP POLICY IF EXISTS "Hermes agents can read orders" ON public.orders;
DROP POLICY IF EXISTS "hermes_rw can write orders" ON public.orders;
DROP POLICY IF EXISTS "hermes_rw can update orders" ON public.orders;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.orders TO anon;

-- ---- products ----
DROP POLICY IF EXISTS "Anyone can read products" ON public.products;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.products TO anon;

-- ---- categories ----
DROP POLICY IF EXISTS "Anyone can read categories" ON public.categories;
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.categories TO anon;

-- ---- coupons (pre-existing policies "Anyone can read active coupons" and
-- "Only admins can manage coupons" are untouched by this migration and stay) ----
ALTER TABLE public.coupons DISABLE ROW LEVEL SECURITY;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.coupons TO anon;

-- ---- shipping_methods (pre-existing "Anyone can read active shipping methods"
-- is untouched and stays) ----
DROP POLICY IF EXISTS "Hermes agents can read shipping methods" ON public.shipping_methods;
ALTER TABLE public.shipping_methods DISABLE ROW LEVEL SECURITY;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.shipping_methods TO anon;

-- ---- order_communications ----
DROP POLICY IF EXISTS "Customers can read their own order communications" ON public.order_communications;
DROP POLICY IF EXISTS "Customers can write their own order communications" ON public.order_communications;
DROP POLICY IF EXISTS "Customers can mark their own order communications read" ON public.order_communications;
ALTER TABLE public.order_communications DISABLE ROW LEVEL SECURITY;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.order_communications TO anon;
-- Restore the pre-migration residual test policy verbatim (see header note).
CREATE POLICY allow_all_for_testing ON public.order_communications USING (true) WITH CHECK (true);

-- ---- hermes_notifications ----
DROP POLICY IF EXISTS "hermes_notifier can read and update the outbox" ON public.hermes_notifications;
DROP POLICY IF EXISTS "hermes_notifier can mark notifications sent" ON public.hermes_notifications;
ALTER TABLE public.hermes_notifications DISABLE ROW LEVEL SECURITY;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.hermes_notifications TO anon;

-- ---- hermes_pending_writes ----
DROP POLICY IF EXISTS "hermes_rw can manage its own pending writes" ON public.hermes_pending_writes;
ALTER TABLE public.hermes_pending_writes DISABLE ROW LEVEL SECURITY;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.hermes_pending_writes TO anon;

COMMIT;
