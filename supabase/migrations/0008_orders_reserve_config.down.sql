--
-- 0008_orders_reserve_config.down.sql
--
-- SDD artifacts live at ../../../openspec/changes/consolidado-web-2027/ (outside this repo,
-- see R2-003).
--
-- Rollback for 0008_orders_reserve_config.sql (ADR-D5 `.down.sql` convention).
--
-- THIS ONE LOSES DATA, unlike 0007. Dropping the columns discards every reserve negotiated away
-- from the default: an order agreed at 50%, or at a fixed CLP deposit, reverts to whatever the
-- applications assume. Capture what would be lost before running it:
--
--   SELECT id, order_key, reserve_type, reserve_value
--     FROM public.orders
--    WHERE reserve_type <> 'percent' OR reserve_value <> 25
--    ORDER BY id;
--
-- If that returns rows, this rollback is destructive in a way re-applying cannot undo — the
-- forward migration restores the columns with every order back at percent/25.
--
-- It also re-breaks the save path: `ProcessOrder` and `PaymentsTable` keep offering the reserve
-- toggle, and `/api/orders/update/[id]` keeps forwarding the pair, so every save returns to
-- failing with `42703`. Roll back only to unblock an apply, and re-apply forward.
--
-- The CHECK constraints and the COMMENTs are dropped together with the columns they hang off — no
-- separate statements needed.
--
-- Idempotent: IF EXISTS, so a re-run is safe.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- =========================================================================
-- ROLE GUARD. Same reasoning as the forward migration: `ALTER TABLE ... DROP COLUMN` requires
-- ownership, and in production `public` relations are owned by `supabase_admin`, not `postgres`.
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

ALTER TABLE public.orders
    DROP COLUMN IF EXISTS reserve_value;

ALTER TABLE public.orders
    DROP COLUMN IF EXISTS reserve_type;

COMMIT;

-- =========================================================================
-- Post-rollback: PostgREST caches the schema, so the dropped columns linger in its map until the
-- cache is refreshed. Reload it so the rolled-back state is the observed state.
--
--   NOTIFY pgrst, 'reload schema';
-- =========================================================================
