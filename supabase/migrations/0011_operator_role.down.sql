--
-- 0011_operator_role.down.sql
--
-- SDD artifacts live at ../../../openspec/changes/consolidado-web-2027/ (outside this repo,
-- see R2-003).
--
-- Rollback for 0011_operator_role.sql (ADR-D5 `.down.sql` convention).
--
-- DATA LOSS, of two kinds. Dropping `is_active` reactivates every deactivated account the moment
-- the application stops reading the column — a worker who was let go can log in again. Dropping
-- the CHECK leaves any `operator` rows in place but unconstrained; they keep working only as long
-- as the application code that knows the role is deployed. Capture the state before running this
-- on any environment where operators exist:
--
--   SELECT id, email, role, is_active
--     FROM public.admin_users
--    WHERE role = 'operator' OR is_active = false
--    ORDER BY id;
--
-- If that returns rows, deactivate or delete those accounts by hand BEFORE rolling back — after
-- the column is gone there is no flag left to honour.
--
-- It also re-breaks the operator paths: `OperatorService`, `/operators` and the `is_active` read
-- in `getServerAdmin` return to failing with `42703`. Roll back only to unblock an apply, and
-- re-apply forward.
--
-- The COMMENT on the constraint is dropped with it; the column's COMMENT with the column.
-- Privileges are untouched in both directions.
--
-- Idempotent: IF EXISTS, so a re-run is safe.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- =========================================================================
-- ROLE GUARD. Same reasoning as the forward migration: `ALTER TABLE ... DROP COLUMN` and
-- `DROP CONSTRAINT` require ownership, and in production `public` relations are owned by
-- `supabase_admin`, not `postgres`.
--
-- Apply with:  psql -U supabase_admin -v ON_ERROR_STOP=1 -f <this file>
-- =========================================================================
DO $role_guard$
BEGIN
  IF NOT pg_has_role(current_user, 'supabase_admin', 'USAGE') THEN
    RAISE EXCEPTION
      'Este rollback debe ejecutarse como supabase_admin (rol actual: %). Las relaciones de public '
      'pertenecen a supabase_admin: ALTER TABLE ... DROP COLUMN exige ser dueno de la tabla.',
      current_user
      USING HINT = 'psql -U supabase_admin -v ON_ERROR_STOP=1 -f <archivo>';
  END IF;
END
$role_guard$;

ALTER TABLE public.admin_users
    DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE public.admin_users
    DROP COLUMN IF EXISTS is_active;

COMMIT;

-- =========================================================================
-- Post-rollback: PostgREST caches the schema, so the dropped column lingers in its map until the
-- cache is refreshed. Reload it so the rolled-back state is the observed state.
--
--   NOTIFY pgrst, 'reload schema';
-- =========================================================================
