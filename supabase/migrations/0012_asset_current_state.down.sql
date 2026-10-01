--
-- 0012_asset_current_state.down.sql
--
-- SDD artifacts live at ../../../openspec/changes/consolidado-web-2027/ (outside this repo,
-- see R2-003).
--
-- Rollback for 0012_asset_current_state.sql (ADR-D5 `.down.sql` convention).
--
-- NO DATA LOSS: the view holds no rows of its own; `asset_movements` is untouched.
--
-- It does re-break the application: `AssetMovementService.listFeed`, `BodegaService.getBoard`
-- and the KPIs on `/inventory/movements` read `asset_current_state` and return to failing with
-- `42P01` (relation does not exist). Roll back only to unblock an apply, and re-apply forward.
--
-- Privileges: the REVOKE/GRANT of the forward migration are on the view and go with it.
--
-- Idempotent: IF EXISTS, so a re-run is safe.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- =========================================================================
-- ROLE GUARD. Same reasoning as the forward migration: `DROP VIEW` requires ownership, and in
-- production `public` relations are owned by `supabase_admin`, not `postgres`.
--
-- Apply with:  psql -U supabase_admin -v ON_ERROR_STOP=1 -f <this file>
-- =========================================================================
DO $role_guard$
BEGIN
  IF NOT pg_has_role(current_user, 'supabase_admin', 'USAGE') THEN
    RAISE EXCEPTION
      'Este rollback debe ejecutarse como supabase_admin (rol actual: %). Las relaciones de public '
      'pertenecen a supabase_admin: DROP VIEW exige ser dueno de la vista.',
      current_user
      USING HINT = 'psql -U supabase_admin -v ON_ERROR_STOP=1 -f <archivo>';
  END IF;
END
$role_guard$;

DROP VIEW IF EXISTS public.asset_current_state;

COMMIT;

-- =========================================================================
-- Post-rollback: PostgREST caches the schema, so the dropped view lingers in its map until the
-- cache is refreshed.
--
--   NOTIFY pgrst, 'reload schema';
-- =========================================================================
