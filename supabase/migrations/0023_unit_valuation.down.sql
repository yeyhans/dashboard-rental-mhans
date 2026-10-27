--
-- 0023_unit_valuation.down.sql
--
-- Rollback for 0023_unit_valuation.sql (ADR-D5 `.down.sql` convention).
--
-- DATA LOSS. This discards the purchase date and the market price of every unit, including the
-- market price that was seeded from `products.market_value_clp`. The seed is reproducible —
-- re-applying 0023 restores it from the model — but a price an operator had EDITED for a single
-- unit is not. Capture what would be lost before running it:
--
--   SELECT id, asset_tag, purchase_date, market_price
--     FROM public.serialised_assets
--    WHERE purchase_date IS NOT NULL OR market_price IS NOT NULL;
--
-- `acquisition_cost` SURVIVES: it is older than this migration (0006) and this rollback does not
-- touch it.
--
-- Idempotent: IF EXISTS throughout.
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

ALTER TABLE public.serialised_assets
    DROP CONSTRAINT IF EXISTS serialised_assets_market_price_check;

ALTER TABLE public.serialised_assets
    DROP COLUMN IF EXISTS market_price,
    DROP COLUMN IF EXISTS purchase_date;

COMMIT;

-- =========================================================================
-- Post-rollback: PostgREST caches the schema; reload it.
--
--   NOTIFY pgrst, 'reload schema';
-- =========================================================================
