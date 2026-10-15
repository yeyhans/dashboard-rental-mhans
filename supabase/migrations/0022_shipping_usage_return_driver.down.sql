--
-- 0022_shipping_usage_return_driver.down.sql
--
-- Rollback for 0022_shipping_usage_return_driver.sql (ADR-D5 `.down.sql` convention).
--
-- DATA LOSS: dropping the column deletes every recorded return driver. Export first if they matter:
--   SELECT id, order_id, return_driver_name FROM public.shipping_usage WHERE return_driver_name IS NOT NULL;
--
-- `driver_name` (0017) is not touched.
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

ALTER TABLE public.shipping_usage
    DROP CONSTRAINT IF EXISTS shipping_usage_return_driver_name_length;
ALTER TABLE public.shipping_usage
    DROP COLUMN IF EXISTS return_driver_name;

COMMIT;
