--
-- 0017_shipping_usage_driver_name.sql — driver (conductor) of a shipment (R-06).
--
-- WHY. The Delivery canon (`MarioHans_OS_Area01_Delivery_Canonical_RC2.1.3.html`) shows a
-- Conductor column in the active and history tables and a "Filtrar por conductor" filter, and the
-- client asked to assign the driver when editing an order. `shipping_usage` had nowhere to store
-- it, so `DeliveryBoard` documented the column as omitted.
--
-- SHAPE. Free text, nullable (most shipments have no driver yet, and pickups never do). Capped at
-- 80 characters in the database as well as in the application (`normalizeDriverName`,
-- `lib/delivery.ts`), so a direct write cannot store something the panel would reject.
-- No driver table on purpose: the business has a handful of drivers and no requirement to manage
-- them; suggestions come from the names already used.
--
-- PRIVILEGES. A new column inherits the table's grants; `shipping_usage` is reached only through
-- the service-role client (0005 convention), so no GRANT is needed.
--
-- COMPATIBILITY. The application reads `shipping_usage` with `select('*')` and turns "column does
-- not exist" into a clear message on write, so it runs before and after this migration.
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
    ADD COLUMN IF NOT EXISTS driver_name text NULL;

ALTER TABLE public.shipping_usage
    DROP CONSTRAINT IF EXISTS shipping_usage_driver_name_length;
ALTER TABLE public.shipping_usage
    ADD CONSTRAINT shipping_usage_driver_name_length
    CHECK (driver_name IS NULL OR char_length(driver_name) BETWEEN 1 AND 80);

COMMENT ON COLUMN public.shipping_usage.driver_name IS
    'Driver (conductor) assigned to the shipment, free text, max 80 chars. NULL = unassigned. R-06.';

COMMIT;

-- Post-apply check:
--
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'shipping_usage' AND column_name = 'driver_name';
