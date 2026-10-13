--
-- 0019_orders_discount_percent.down.sql
--
-- Rollback for 0019_orders_discount_percent.sql (ADR-D5 `.down.sql` convention).
--
-- DATA LOSS: the percentage is dropped. The discount AMOUNT survives in `calculated_discount`, so
-- every order keeps its totals; what is lost is that a later edit would recompute the discount
-- from the new subtotal — after the rollback it behaves as a flat amount. Export first if needed:
--   SELECT id, discount_percent FROM public.orders WHERE discount_percent IS NOT NULL;
--
-- Idempotent: IF EXISTS, so a re-run is safe.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

DO $role_guard$
BEGIN
  IF NOT pg_has_role(current_user, 'supabase_admin', 'USAGE') THEN
    RAISE EXCEPTION
      'Este rollback debe ejecutarse como supabase_admin (rol actual: %). ALTER TABLE exige ser dueno de la relacion.',
      current_user
      USING HINT = 'psql -U supabase_admin -v ON_ERROR_STOP=1 -f <archivo>';
  END IF;
END
$role_guard$;

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_discount_percent_range;
ALTER TABLE public.orders
    DROP COLUMN IF EXISTS discount_percent;

COMMIT;
