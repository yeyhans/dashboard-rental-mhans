--
-- 0021_warehouse_units_locations.down.sql
--
-- Rollback for 0021_warehouse_units_locations.sql (ADR-D5 `.down.sql` convention).
--
-- DATA LOSS. This discards every structured location, the relocation history, unit wear
-- (Nuevo/Usado), row versions and movement incident types. The legacy `location` text survives:
-- while 0021 was applied it was kept equal to "CODE · Name", so units still read where they are.
-- Capture what would be lost before running it:
--
--   SELECT count(*) FROM public.warehouse_locations;
--   SELECT count(*) FROM public.asset_relocations;
--   SELECT count(*) FROM public.serialised_assets WHERE wear = 'new';
--   SELECT count(*) FROM public.asset_movements WHERE incident_type IS NOT NULL;
--
-- REFUSES while any unit is `blocked`: the restored five-value CHECK would reject those rows.
-- Re-classify them first (an explicit, reviewed UPDATE — this file does not guess a mapping).
--
-- Idempotent: IF EXISTS throughout; the condition CHECK is dropped and re-added by name.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

DO $role_guard$
BEGIN
  IF NOT pg_has_role(current_user, 'supabase_admin', 'USAGE') THEN
    RAISE EXCEPTION
      'Este rollback debe ejecutarse como supabase_admin (rol actual: %). Las relaciones de public '
      'pertenecen a supabase_admin: ALTER/DROP exigen ser dueno.',
      current_user
      USING HINT = 'psql -U supabase_admin -v ON_ERROR_STOP=1 -f <archivo>';
  END IF;
END
$role_guard$;

DROP VIEW IF EXISTS public.product_unit_counts;

DROP TABLE IF EXISTS public.asset_relocations;
DROP FUNCTION IF EXISTS public.asset_relocations_apply();

DROP TRIGGER IF EXISTS serialised_assets_sync_location ON public.serialised_assets;
DROP FUNCTION IF EXISTS public.serialised_assets_sync_location();
DROP TRIGGER IF EXISTS serialised_assets_bump_row_version ON public.serialised_assets;

DO $refuse_blocked$
DECLARE
  blocked_units integer;
BEGIN
  SELECT count(*) INTO blocked_units FROM public.serialised_assets WHERE condition = 'blocked';
  IF blocked_units > 0 THEN
    RAISE EXCEPTION
      'Abortado: % unidad(es) en estado blocked. Reclasificalas antes de restaurar la restriccion '
      'de cinco valores.', blocked_units;
  END IF;
END
$refuse_blocked$;

ALTER TABLE public.serialised_assets DROP CONSTRAINT IF EXISTS serialised_assets_condition_check;
ALTER TABLE public.serialised_assets ADD CONSTRAINT serialised_assets_condition_check CHECK (condition IN ('operational', 'maintenance', 'cleaning', 'damaged', 'retired'));

ALTER TABLE public.serialised_assets
    DROP COLUMN IF EXISTS location_id,
    DROP COLUMN IF EXISTS row_version,
    DROP COLUMN IF EXISTS wear;

ALTER TABLE public.asset_movements
    DROP COLUMN IF EXISTS incident_type;

DROP TABLE IF EXISTS public.warehouse_locations;
DROP FUNCTION IF EXISTS public.warehouse_locations_propagate_label();
DROP FUNCTION IF EXISTS public.warehouse_locations_validate_parent();
DROP FUNCTION IF EXISTS public.bump_row_version();

COMMIT;

-- =========================================================================
-- Post-rollback: PostgREST caches the schema; reload it.
--
--   NOTIFY pgrst, 'reload schema';
-- =========================================================================
