--
-- 0001_m1_grants_rls.down.sql
--
-- SDD artifacts live at ../../../openspec/changes/consolidado-web-2027/ (outside this repo,
-- see R2-003).
--
-- Rollback for 0001_m1_grants_rls.sql. Hand-authored to restore exactly what the forward
-- migration revoked/created, cross-checked against _snapshot_0001_pre_revoke.sql (T-012,
-- extended for `authenticated` per R1-001) at authoring time (2026-08-18) — NOT mechanically
-- generated from that snapshot file (R3-005: the original header overstated this; content is
-- verified correct against the snapshot as of this date, but a future drift between the two
-- files would not be caught automatically). Drops every policy this migration created and
-- restores the pre-migration state, including the residual `allow_all_for_testing` policy on
-- `order_communications` this migration removed.
--
-- Data-loss note: recreating `allow_all_for_testing` restores the exact pre-migration posture,
-- intentionally including that pre-existing test-only policy's over-broad grant.
--
-- SECURITY note for the view section (T-014d): reverting `security_invoker` and re-granting
-- `anon`/`authenticated` SELECT on `order_summary` deliberately re-opens the PII bypass — 468
-- rows of billing_email / profile_rut / financials readable with the public anon key. That is what
-- "restore the pre-migration state" means here; it is not an oversight. Do not park the chain on
-- this rollback. `RESET` (not `SET (security_invoker = off)`) is used so `pg_class.reloptions`
-- returns to NULL, matching the verified pre-migration state exactly rather than to
-- `{security_invoker=off}`, which is semantically equal but would defeat a reloptions-equality
-- assertion.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

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
GRANT DELETE, TRUNCATE ON public.orders TO authenticated;

-- ---- products ----
DROP POLICY IF EXISTS "Anyone can read products" ON public.products;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.products TO anon;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.products TO authenticated;

-- ---- categories ----
DROP POLICY IF EXISTS "Anyone can read categories" ON public.categories;
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.categories TO anon;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.categories TO authenticated;

-- ---- coupons (pre-existing policies "Anyone can read active coupons" and
-- "Only admins can manage coupons" are untouched by this migration and stay) ----
DROP POLICY IF EXISTS "Hermes agents can read coupons" ON public.coupons;
ALTER TABLE public.coupons DISABLE ROW LEVEL SECURITY;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.coupons TO anon;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.coupons TO authenticated;

-- ---- shipping_methods (pre-existing "Anyone can read active shipping methods"
-- is untouched and stays) ----
DROP POLICY IF EXISTS "Hermes agents can read shipping methods" ON public.shipping_methods;
ALTER TABLE public.shipping_methods DISABLE ROW LEVEL SECURITY;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.shipping_methods TO anon;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.shipping_methods TO authenticated;

-- ---- order_communications ----
DROP POLICY IF EXISTS "Customers can read their own order communications" ON public.order_communications;
DROP POLICY IF EXISTS "Customers can write their own order communications" ON public.order_communications;
DROP POLICY IF EXISTS "Customers can mark their own order communications read" ON public.order_communications;
DROP POLICY IF EXISTS "Customers can delete their own order communications" ON public.order_communications;
ALTER TABLE public.order_communications DISABLE ROW LEVEL SECURITY;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.order_communications TO anon;
GRANT TRUNCATE ON public.order_communications TO authenticated;
-- Restore the pre-migration residual test policy verbatim (see header note).
DROP POLICY IF EXISTS allow_all_for_testing ON public.order_communications;
CREATE POLICY allow_all_for_testing ON public.order_communications USING (true) WITH CHECK (true);

-- ---- hermes_notifications ----
DROP POLICY IF EXISTS "hermes_notifier can read and update the outbox" ON public.hermes_notifications;
DROP POLICY IF EXISTS "hermes_notifier can mark notifications sent" ON public.hermes_notifications;
ALTER TABLE public.hermes_notifications DISABLE ROW LEVEL SECURITY;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.hermes_notifications TO anon;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.hermes_notifications TO authenticated;

-- ---- hermes_pending_writes ----
DROP POLICY IF EXISTS "hermes_rw can manage its own pending writes" ON public.hermes_pending_writes;
ALTER TABLE public.hermes_pending_writes DISABLE ROW LEVEL SECURITY;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.hermes_pending_writes TO anon;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.hermes_pending_writes TO authenticated;

-- ---- views (see the SECURITY note in the header) ----
ALTER VIEW public.order_summary RESET (security_invoker);
GRANT SELECT ON public.order_summary TO anon;
GRANT SELECT ON public.order_summary TO authenticated;

ALTER VIEW public.products_with_categories RESET (security_invoker);

COMMIT;
