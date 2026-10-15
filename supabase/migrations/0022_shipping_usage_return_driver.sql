--
-- 0022_shipping_usage_return_driver.sql — driver (conductor) of the return leg of a shipment.
--
-- WHY. The driver who delivers the equipment is not always the one who brings it back.
-- `shipping_usage.driver_name` (0017) holds a single driver, so a different return driver had
-- nowhere to be recorded.
--
-- SHAPE. Free text, nullable. NULL means the delivery driver also does the return, so every
-- existing shipment keeps its current meaning without a backfill. Capped at 80 characters with
-- exactly the same CHECK expression as `driver_name` (0017), so both columns accept the same
-- values and the application can reuse `normalizeDriverName` (`lib/delivery.ts`).
--
-- PRIVILEGES. A new column inherits the table's grants; `shipping_usage` is reached only through
-- the service-role client (0005 convention), so no GRANT is needed.
--
-- COMPATIBILITY. The application reads `shipping_usage` with `select('*')`, so it runs before and
-- after this migration.
--
-- Apply with:  psql -U supabase_admin -v ON_ERROR_STOP=1 -f <this file>
-- Idempotent: IF NOT EXISTS / DROP CONSTRAINT IF EXISTS, so a partial apply can be replayed.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

DO $role_guard$
BEGIN
  IF NOT pg_has_role(current_user, 'supabase_admin', 'USAGE') THEN
    RAISE EXCEPTION
      'Esta migracion debe ejecutarse como supabase_admin (rol actual: %). ALTER TABLE exige ser '
      'dueno de la relacion, y las relaciones de public pertenecen a supabase_admin.',
      current_user
      USING HINT = 'psql -U supabase_admin -v ON_ERROR_STOP=1 -f <archivo>';
  END IF;
END
$role_guard$;

ALTER TABLE public.shipping_usage
    ADD COLUMN IF NOT EXISTS return_driver_name text NULL;

ALTER TABLE public.shipping_usage
    DROP CONSTRAINT IF EXISTS shipping_usage_return_driver_name_length;
ALTER TABLE public.shipping_usage
    ADD CONSTRAINT shipping_usage_return_driver_name_length
    CHECK (return_driver_name IS NULL OR char_length(return_driver_name) BETWEEN 1 AND 80);

COMMENT ON COLUMN public.shipping_usage.return_driver_name IS
    'Driver (conductor) who does the return, free text, max 80 chars. NULL = the delivery driver also does the return.';

COMMIT;

-- Post-apply check:
--
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'shipping_usage' AND column_name = 'return_driver_name';
