--
-- 0010_product_valuation.down.sql
--
-- SDD artifacts live at ../../../openspec/changes/consolidado-web-2027/ (outside this repo,
-- see R2-003).
--
-- Rollback for 0010_product_valuation.sql (ADR-D5 `.down.sql` convention).
--
-- DATA LOSS. Dropping the three columns discards every declared quantity and every market/used
-- value entered from the client's spreadsheet — data that exists nowhere else in the system and
-- was typed in model by model. Capture it before running this on any environment where the
-- entry has started:
--
--   SELECT id, sku, name, declared_quantity, market_value_clp, used_value_clp
--     FROM public.products
--    WHERE declared_quantity IS NOT NULL
--       OR market_value_clp IS NOT NULL
--       OR used_value_clp IS NOT NULL
--    ORDER BY id;
--
-- If that returns rows, this rollback is destructive in a way re-applying cannot undo — the
-- forward migration restores the columns empty.
--
-- It also removes the data-quality columns the intake dashboard reads (the valuation dialog and
-- the discrepancy badge fall back to "sin declarar" for every product) and the PUT
-- `/api/products/[id]` write of those fields returns to failing with `42703`. Roll back only to
-- unblock an apply, and re-apply forward.
--
-- The CHECK constraints and the COMMENTs are dropped together with the columns they hang off — no
-- separate statements needed. Privileges are untouched in both directions.
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

ALTER TABLE public.products
    DROP COLUMN IF EXISTS used_value_clp;

ALTER TABLE public.products
    DROP COLUMN IF EXISTS market_value_clp;

ALTER TABLE public.products
    DROP COLUMN IF EXISTS declared_quantity;

COMMIT;

-- =========================================================================
-- Post-rollback: PostgREST caches the schema, so the dropped columns linger in its map until the
-- cache is refreshed. Reload it so the rolled-back state is the observed state.
--
--   NOTIFY pgrst, 'reload schema';
-- =========================================================================
