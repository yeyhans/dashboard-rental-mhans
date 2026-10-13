--
-- 0018_orders_return_report.down.sql
--
-- Rollback for 0018_orders_return_report.sql (ADR-D5 `.down.sql` convention).
--
-- DATA LOSS: dropping the column deletes every saved return report, including incidents on lines
-- without serial numbers, which exist nowhere else. Export first:
--   SELECT id, return_report FROM public.orders WHERE return_report IS NOT NULL;
--
-- The application keeps working after the rollback: closing a return succeeds and answers with
-- the "falta aplicar la migración 0018" warning.
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
    DROP CONSTRAINT IF EXISTS orders_return_report_shape;
ALTER TABLE public.orders
    DROP COLUMN IF EXISTS return_report;

COMMIT;
