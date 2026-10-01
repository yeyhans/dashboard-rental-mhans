--
-- 0007_shipping_usage_order_fk.down.sql
--
-- SDD artifacts live at ../../../openspec/changes/consolidado-web-2027/ (outside this repo,
-- see R2-003).
--
-- Rollback for 0007_shipping_usage_order_fk.sql (ADR-D5 `.down.sql` convention).
--
-- NO DATA LOSS. This drops a constraint, not data: every `shipping_usage` row survives untouched.
-- What is lost is the guarantee — after this runs, an order can be deleted while its shipment row
-- stays behind as an orphan, and PostgREST stops resolving the `orders` embed in
-- `DeliveryService.getBoard`, which is the exact defect 0007 was written to fix. Rolling this back
-- re-breaks `/delivery`; do it only to unblock an apply, and re-apply forward.
--
-- The `COMMENT ON CONSTRAINT` set by the forward migration is dropped together with the
-- constraint it is attached to — no separate statement needed.
--
-- Idempotent: IF EXISTS, so a re-run is safe.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- =========================================================================
-- ROLE GUARD. Same reasoning as the forward migration: `ALTER TABLE ... DROP CONSTRAINT` requires
-- ownership, and in production `public` relations are owned by `supabase_admin`, not `postgres`.
--
-- Apply with:  psql -U supabase_admin -v ON_ERROR_STOP=1 -f <this file>
-- =========================================================================
DO $role_guard$
BEGIN
  IF NOT pg_has_role(current_user, 'supabase_admin', 'USAGE') THEN
    RAISE EXCEPTION
      'Este rollback debe ejecutarse como supabase_admin (rol actual: %). Las relaciones de public '
      'pertenecen a supabase_admin: ALTER TABLE ... DROP CONSTRAINT exige ser dueno de la tabla.',
      current_user
      USING HINT = 'psql -U supabase_admin -v ON_ERROR_STOP=1 -f <archivo>';
  END IF;
END
$role_guard$;

ALTER TABLE public.shipping_usage
    DROP CONSTRAINT IF EXISTS shipping_usage_order_id_fkey;

COMMIT;

-- =========================================================================
-- Post-rollback: PostgREST caches the relationship map, so the embed keeps working until the
-- cache is refreshed. Reload it so the rolled-back state is the observed state.
--
--   NOTIFY pgrst, 'reload schema';
-- =========================================================================
