--
-- _snapshot_0001_pre_revoke.sql
--
-- Renamed from 0001_pre_revoke_snapshot.sql (R2-001): a numeric-prefixed filename inside
-- migrations/ reads as "appliable" by the migration chain, but this file is a reference
-- snapshot only — see below.
--
-- SDD artifacts live at ../../../openspec/changes/consolidado-web-2027/ (outside this repo,
-- see R2-003).
--
-- Pre-revocation grant snapshot (T-012, grants-rls-closure/spec.md — "Snapshot-based
-- rollback for grant changes"). Captured from production `information_schema.role_table_grants`
-- for the 8 tables `0001_m1_grants_rls.sql` remediates, 2026-08-18, BEFORE any REVOKE. Covers
-- BOTH `anon` and `authenticated` grantees (the R1-001 fix pass extended the forward migration
-- to also revoke from `authenticated`; this snapshot already included `authenticated` rows from
-- the original capture, so no re-capture was needed).
--
-- This file is NOT applied by the migration chain. It exists purely as the reference snapshot
-- `0001_m1_grants_rls.down.sql`'s re-GRANT statements were hand-authored against (R3-005: the
-- down script is NOT mechanically generated from this file — cross-checked against it at
-- authoring time, which means future drift between the two is not caught automatically) — kept
-- version-controlled and separate from the down script itself so the down script's intent
-- (revert to exactly this state) is auditable independently of its implementation.
--
-- Note: this is the full per-privilege enumeration pg_dump/information_schema produces
-- (SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER) for every grantee including
-- `postgres`/`service_role`, not just the write privileges `0001` revokes from `anon`/
-- `authenticated` — the down script only needs to restore what `0001` actually revokes, but the
-- full snapshot is kept here for completeness and future audit value.
--

GRANT DELETE ON TABLE public.categories TO anon;
GRANT INSERT ON TABLE public.categories TO anon;
GRANT REFERENCES ON TABLE public.categories TO anon;
GRANT SELECT ON TABLE public.categories TO anon;
GRANT TRIGGER ON TABLE public.categories TO anon;
GRANT TRUNCATE ON TABLE public.categories TO anon;
GRANT UPDATE ON TABLE public.categories TO anon;
GRANT DELETE ON TABLE public.categories TO authenticated;
GRANT INSERT ON TABLE public.categories TO authenticated;
GRANT REFERENCES ON TABLE public.categories TO authenticated;
GRANT SELECT ON TABLE public.categories TO authenticated;
GRANT TRIGGER ON TABLE public.categories TO authenticated;
GRANT TRUNCATE ON TABLE public.categories TO authenticated;
GRANT UPDATE ON TABLE public.categories TO authenticated;
GRANT DELETE ON TABLE public.categories TO postgres;
GRANT INSERT ON TABLE public.categories TO postgres;
GRANT REFERENCES ON TABLE public.categories TO postgres;
GRANT SELECT ON TABLE public.categories TO postgres;
GRANT TRIGGER ON TABLE public.categories TO postgres;
GRANT TRUNCATE ON TABLE public.categories TO postgres;
GRANT UPDATE ON TABLE public.categories TO postgres;
GRANT DELETE ON TABLE public.categories TO service_role;
GRANT INSERT ON TABLE public.categories TO service_role;
GRANT REFERENCES ON TABLE public.categories TO service_role;
GRANT SELECT ON TABLE public.categories TO service_role;
GRANT TRIGGER ON TABLE public.categories TO service_role;
GRANT TRUNCATE ON TABLE public.categories TO service_role;
GRANT UPDATE ON TABLE public.categories TO service_role;
GRANT DELETE ON TABLE public.coupons TO anon;
GRANT INSERT ON TABLE public.coupons TO anon;
GRANT REFERENCES ON TABLE public.coupons TO anon;
GRANT SELECT ON TABLE public.coupons TO anon;
GRANT TRIGGER ON TABLE public.coupons TO anon;
GRANT TRUNCATE ON TABLE public.coupons TO anon;
GRANT UPDATE ON TABLE public.coupons TO anon;
GRANT DELETE ON TABLE public.coupons TO authenticated;
GRANT INSERT ON TABLE public.coupons TO authenticated;
GRANT REFERENCES ON TABLE public.coupons TO authenticated;
GRANT SELECT ON TABLE public.coupons TO authenticated;
GRANT TRIGGER ON TABLE public.coupons TO authenticated;
GRANT TRUNCATE ON TABLE public.coupons TO authenticated;
GRANT UPDATE ON TABLE public.coupons TO authenticated;
GRANT DELETE ON TABLE public.coupons TO postgres;
GRANT INSERT ON TABLE public.coupons TO postgres;
GRANT REFERENCES ON TABLE public.coupons TO postgres;
GRANT SELECT ON TABLE public.coupons TO postgres;
GRANT TRIGGER ON TABLE public.coupons TO postgres;
GRANT TRUNCATE ON TABLE public.coupons TO postgres;
GRANT UPDATE ON TABLE public.coupons TO postgres;
GRANT DELETE ON TABLE public.coupons TO service_role;
GRANT INSERT ON TABLE public.coupons TO service_role;
GRANT REFERENCES ON TABLE public.coupons TO service_role;
GRANT SELECT ON TABLE public.coupons TO service_role;
GRANT TRIGGER ON TABLE public.coupons TO service_role;
GRANT TRUNCATE ON TABLE public.coupons TO service_role;
GRANT UPDATE ON TABLE public.coupons TO service_role;
GRANT DELETE ON TABLE public.hermes_notifications TO anon;
GRANT INSERT ON TABLE public.hermes_notifications TO anon;
GRANT REFERENCES ON TABLE public.hermes_notifications TO anon;
GRANT SELECT ON TABLE public.hermes_notifications TO anon;
GRANT TRIGGER ON TABLE public.hermes_notifications TO anon;
GRANT TRUNCATE ON TABLE public.hermes_notifications TO anon;
GRANT UPDATE ON TABLE public.hermes_notifications TO anon;
GRANT DELETE ON TABLE public.hermes_notifications TO authenticated;
GRANT INSERT ON TABLE public.hermes_notifications TO authenticated;
GRANT REFERENCES ON TABLE public.hermes_notifications TO authenticated;
GRANT SELECT ON TABLE public.hermes_notifications TO authenticated;
GRANT TRIGGER ON TABLE public.hermes_notifications TO authenticated;
GRANT TRUNCATE ON TABLE public.hermes_notifications TO authenticated;
GRANT UPDATE ON TABLE public.hermes_notifications TO authenticated;
GRANT DELETE ON TABLE public.hermes_notifications TO postgres;
GRANT INSERT ON TABLE public.hermes_notifications TO postgres;
GRANT REFERENCES ON TABLE public.hermes_notifications TO postgres;
GRANT SELECT ON TABLE public.hermes_notifications TO postgres;
GRANT TRIGGER ON TABLE public.hermes_notifications TO postgres;
GRANT TRUNCATE ON TABLE public.hermes_notifications TO postgres;
GRANT UPDATE ON TABLE public.hermes_notifications TO postgres;
GRANT DELETE ON TABLE public.hermes_notifications TO service_role;
GRANT INSERT ON TABLE public.hermes_notifications TO service_role;
GRANT REFERENCES ON TABLE public.hermes_notifications TO service_role;
GRANT SELECT ON TABLE public.hermes_notifications TO service_role;
GRANT TRIGGER ON TABLE public.hermes_notifications TO service_role;
GRANT TRUNCATE ON TABLE public.hermes_notifications TO service_role;
GRANT UPDATE ON TABLE public.hermes_notifications TO service_role;
GRANT DELETE ON TABLE public.hermes_pending_writes TO anon;
GRANT INSERT ON TABLE public.hermes_pending_writes TO anon;
GRANT REFERENCES ON TABLE public.hermes_pending_writes TO anon;
GRANT SELECT ON TABLE public.hermes_pending_writes TO anon;
GRANT TRIGGER ON TABLE public.hermes_pending_writes TO anon;
GRANT TRUNCATE ON TABLE public.hermes_pending_writes TO anon;
GRANT UPDATE ON TABLE public.hermes_pending_writes TO anon;
GRANT DELETE ON TABLE public.hermes_pending_writes TO authenticated;
GRANT INSERT ON TABLE public.hermes_pending_writes TO authenticated;
GRANT REFERENCES ON TABLE public.hermes_pending_writes TO authenticated;
GRANT SELECT ON TABLE public.hermes_pending_writes TO authenticated;
GRANT TRIGGER ON TABLE public.hermes_pending_writes TO authenticated;
GRANT TRUNCATE ON TABLE public.hermes_pending_writes TO authenticated;
GRANT UPDATE ON TABLE public.hermes_pending_writes TO authenticated;
GRANT DELETE ON TABLE public.hermes_pending_writes TO postgres;
GRANT INSERT ON TABLE public.hermes_pending_writes TO postgres;
GRANT REFERENCES ON TABLE public.hermes_pending_writes TO postgres;
GRANT SELECT ON TABLE public.hermes_pending_writes TO postgres;
GRANT TRIGGER ON TABLE public.hermes_pending_writes TO postgres;
GRANT TRUNCATE ON TABLE public.hermes_pending_writes TO postgres;
GRANT UPDATE ON TABLE public.hermes_pending_writes TO postgres;
GRANT DELETE ON TABLE public.hermes_pending_writes TO service_role;
GRANT INSERT ON TABLE public.hermes_pending_writes TO service_role;
GRANT REFERENCES ON TABLE public.hermes_pending_writes TO service_role;
GRANT SELECT ON TABLE public.hermes_pending_writes TO service_role;
GRANT TRIGGER ON TABLE public.hermes_pending_writes TO service_role;
GRANT TRUNCATE ON TABLE public.hermes_pending_writes TO service_role;
GRANT UPDATE ON TABLE public.hermes_pending_writes TO service_role;
GRANT DELETE ON TABLE public.order_communications TO anon;
GRANT INSERT ON TABLE public.order_communications TO anon;
GRANT REFERENCES ON TABLE public.order_communications TO anon;
GRANT SELECT ON TABLE public.order_communications TO anon;
GRANT TRIGGER ON TABLE public.order_communications TO anon;
GRANT TRUNCATE ON TABLE public.order_communications TO anon;
GRANT UPDATE ON TABLE public.order_communications TO anon;
GRANT DELETE ON TABLE public.order_communications TO authenticated;
GRANT INSERT ON TABLE public.order_communications TO authenticated;
GRANT REFERENCES ON TABLE public.order_communications TO authenticated;
GRANT SELECT ON TABLE public.order_communications TO authenticated;
GRANT TRIGGER ON TABLE public.order_communications TO authenticated;
GRANT TRUNCATE ON TABLE public.order_communications TO authenticated;
GRANT UPDATE ON TABLE public.order_communications TO authenticated;
GRANT DELETE ON TABLE public.order_communications TO postgres;
GRANT INSERT ON TABLE public.order_communications TO postgres;
GRANT REFERENCES ON TABLE public.order_communications TO postgres;
GRANT SELECT ON TABLE public.order_communications TO postgres;
GRANT TRIGGER ON TABLE public.order_communications TO postgres;
GRANT TRUNCATE ON TABLE public.order_communications TO postgres;
GRANT UPDATE ON TABLE public.order_communications TO postgres;
GRANT DELETE ON TABLE public.order_communications TO service_role;
GRANT INSERT ON TABLE public.order_communications TO service_role;
GRANT REFERENCES ON TABLE public.order_communications TO service_role;
GRANT SELECT ON TABLE public.order_communications TO service_role;
GRANT TRIGGER ON TABLE public.order_communications TO service_role;
GRANT TRUNCATE ON TABLE public.order_communications TO service_role;
GRANT UPDATE ON TABLE public.order_communications TO service_role;
GRANT DELETE ON TABLE public.orders TO anon;
GRANT INSERT ON TABLE public.orders TO anon;
GRANT REFERENCES ON TABLE public.orders TO anon;
GRANT SELECT ON TABLE public.orders TO anon;
GRANT TRIGGER ON TABLE public.orders TO anon;
GRANT TRUNCATE ON TABLE public.orders TO anon;
GRANT UPDATE ON TABLE public.orders TO anon;
GRANT DELETE ON TABLE public.orders TO authenticated;
GRANT INSERT ON TABLE public.orders TO authenticated;
GRANT REFERENCES ON TABLE public.orders TO authenticated;
GRANT SELECT ON TABLE public.orders TO authenticated;
GRANT TRIGGER ON TABLE public.orders TO authenticated;
GRANT TRUNCATE ON TABLE public.orders TO authenticated;
GRANT UPDATE ON TABLE public.orders TO authenticated;
GRANT DELETE ON TABLE public.orders TO postgres;
GRANT INSERT ON TABLE public.orders TO postgres;
GRANT REFERENCES ON TABLE public.orders TO postgres;
GRANT SELECT ON TABLE public.orders TO postgres;
GRANT TRIGGER ON TABLE public.orders TO postgres;
GRANT TRUNCATE ON TABLE public.orders TO postgres;
GRANT UPDATE ON TABLE public.orders TO postgres;
GRANT DELETE ON TABLE public.orders TO service_role;
GRANT INSERT ON TABLE public.orders TO service_role;
GRANT REFERENCES ON TABLE public.orders TO service_role;
GRANT SELECT ON TABLE public.orders TO service_role;
GRANT TRIGGER ON TABLE public.orders TO service_role;
GRANT TRUNCATE ON TABLE public.orders TO service_role;
GRANT UPDATE ON TABLE public.orders TO service_role;
GRANT DELETE ON TABLE public.products TO anon;
GRANT INSERT ON TABLE public.products TO anon;
GRANT REFERENCES ON TABLE public.products TO anon;
GRANT SELECT ON TABLE public.products TO anon;
GRANT TRIGGER ON TABLE public.products TO anon;
GRANT TRUNCATE ON TABLE public.products TO anon;
GRANT UPDATE ON TABLE public.products TO anon;
GRANT DELETE ON TABLE public.products TO authenticated;
GRANT INSERT ON TABLE public.products TO authenticated;
GRANT REFERENCES ON TABLE public.products TO authenticated;
GRANT SELECT ON TABLE public.products TO authenticated;
GRANT TRIGGER ON TABLE public.products TO authenticated;
GRANT TRUNCATE ON TABLE public.products TO authenticated;
GRANT UPDATE ON TABLE public.products TO authenticated;
GRANT DELETE ON TABLE public.products TO postgres;
GRANT INSERT ON TABLE public.products TO postgres;
GRANT REFERENCES ON TABLE public.products TO postgres;
GRANT SELECT ON TABLE public.products TO postgres;
GRANT TRIGGER ON TABLE public.products TO postgres;
GRANT TRUNCATE ON TABLE public.products TO postgres;
GRANT UPDATE ON TABLE public.products TO postgres;
GRANT DELETE ON TABLE public.products TO service_role;
GRANT INSERT ON TABLE public.products TO service_role;
GRANT REFERENCES ON TABLE public.products TO service_role;
GRANT SELECT ON TABLE public.products TO service_role;
GRANT TRIGGER ON TABLE public.products TO service_role;
GRANT TRUNCATE ON TABLE public.products TO service_role;
GRANT UPDATE ON TABLE public.products TO service_role;
GRANT DELETE ON TABLE public.shipping_methods TO anon;
GRANT INSERT ON TABLE public.shipping_methods TO anon;
GRANT REFERENCES ON TABLE public.shipping_methods TO anon;
GRANT SELECT ON TABLE public.shipping_methods TO anon;
GRANT TRIGGER ON TABLE public.shipping_methods TO anon;
GRANT TRUNCATE ON TABLE public.shipping_methods TO anon;
GRANT UPDATE ON TABLE public.shipping_methods TO anon;
GRANT DELETE ON TABLE public.shipping_methods TO authenticated;
GRANT INSERT ON TABLE public.shipping_methods TO authenticated;
GRANT REFERENCES ON TABLE public.shipping_methods TO authenticated;
GRANT SELECT ON TABLE public.shipping_methods TO authenticated;
GRANT TRIGGER ON TABLE public.shipping_methods TO authenticated;
GRANT TRUNCATE ON TABLE public.shipping_methods TO authenticated;
GRANT UPDATE ON TABLE public.shipping_methods TO authenticated;
GRANT DELETE ON TABLE public.shipping_methods TO postgres;
GRANT INSERT ON TABLE public.shipping_methods TO postgres;
GRANT REFERENCES ON TABLE public.shipping_methods TO postgres;
GRANT SELECT ON TABLE public.shipping_methods TO postgres;
GRANT TRIGGER ON TABLE public.shipping_methods TO postgres;
GRANT TRUNCATE ON TABLE public.shipping_methods TO postgres;
GRANT UPDATE ON TABLE public.shipping_methods TO postgres;
GRANT DELETE ON TABLE public.shipping_methods TO service_role;
GRANT INSERT ON TABLE public.shipping_methods TO service_role;
GRANT REFERENCES ON TABLE public.shipping_methods TO service_role;
GRANT SELECT ON TABLE public.shipping_methods TO service_role;
GRANT TRIGGER ON TABLE public.shipping_methods TO service_role;
GRANT TRUNCATE ON TABLE public.shipping_methods TO service_role;
GRANT UPDATE ON TABLE public.shipping_methods TO service_role;

-- RLS status at snapshot time (all 8 tables): relrowsecurity = false (RLS disabled).
-- `0001_m1_grants_rls.down.sql` restores this by DISABLE ROW LEVEL SECURITY + DROP POLICY.
