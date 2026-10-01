--
-- 0013_coupon_usage_lifecycle.down.sql
--
-- SDD artifacts live at ../../../openspec/changes/consolidado-web-2027/ (outside this repo,
-- see R2-003).
--
-- Rollback for 0013_coupon_usage_lifecycle.sql (ADR-D5 `.down.sql` convention).
--
-- NO DATA LOSS: the two functions hold no state. Every `coupon_usage` row they recorded and every
-- `coupons.usage_count` they incremented stay exactly as they are — dropping the functions does
-- not un-record a use, and this rollback deliberately does not try to.
--
-- It does re-open the hole the migration closed: `OrderService` falls back to logging
-- `[CouponService]` failures ("function does not exist") on every order with a coupon, orders stop
-- recording their usage, cancellations stop releasing it, and `usage_limit` goes back to being
-- decorative. Orders keep being created and cancelled normally — that is the whole point of the
-- failure semantics. Roll back only to unblock an apply, and re-apply forward.
--
-- `apply_coupon` is not touched here: this migration never modified it.
--
-- Idempotent: IF EXISTS, so a re-run is safe.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- =========================================================================
-- ROLE GUARD. Same reasoning as the forward migration: `DROP FUNCTION` requires ownership, and in
-- production `public` objects are owned by `supabase_admin`, not `postgres`.
--
-- Apply with:  psql -U supabase_admin -v ON_ERROR_STOP=1 -f <this file>
-- =========================================================================
DO $role_guard$
BEGIN
  IF NOT pg_has_role(current_user, 'supabase_admin', 'USAGE') THEN
    RAISE EXCEPTION
      'Este rollback debe ejecutarse como supabase_admin (rol actual: %). Los objetos de public '
      'pertenecen a supabase_admin: DROP FUNCTION exige ser dueno de la funcion.',
      current_user
      USING HINT = 'psql -U supabase_admin -v ON_ERROR_STOP=1 -f <archivo>';
  END IF;
END
$role_guard$;

-- The recorder goes first: it is the one that calls the other.
DROP FUNCTION IF EXISTS public.record_coupon_usage_for_order(integer, character varying, integer, numeric);
DROP FUNCTION IF EXISTS public.release_coupon_usage_for_order(integer);

COMMIT;
