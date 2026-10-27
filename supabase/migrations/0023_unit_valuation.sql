--
-- 0023_unit_valuation.sql — per-unit valuation: purchase date and market price.
--
-- Feature doc: odd/tasks/mcp-worker-operacion.md (T1). Shared by the dashboard (admins) and
-- ops.mariohans.cl (operators); the TypeScript contract is src/types/inventory.ts.
--
-- WHY. The catalogue knows what a MODEL is worth (`products.market_value_clp`,
-- `products.used_value_clp`, 0010) and 0006 already stores what a UNIT cost to buy
-- (`serialised_assets.acquisition_cost`). What does not exist is the unit's own purchase date and
-- the unit's own market price. Without them nobody can answer "what is this specific body on the
-- shelf worth", and the MCP worker being built has nowhere to write the answer.
--
-- WHAT.
--   serialised_assets
--     * purchase_date date NULL — when this unit was bought. Nullable: a unit that has never been
--       valued is "not recorded yet", not "bought for free".
--     * market_price numeric(12,2) NULL — the market value of THIS unit, in CLP. Nullable, and
--       never negative.
--     * acquisition_cost — NOT touched: 0006 already added it. 0023 only documents it and exposes
--       it in the shared TypeScript contract, which is what makes it reachable at all. Until this
--       migration the column existed in the database and in no interface, endpoint or UI.
--
-- WHY numeric(12,2) AND NOT numeric(5,2). The request that asked for this migration specified
-- numeric(5,2), which is the shape 0021 uses for the warehouse GEOMETRY (metres). numeric(5,2)
-- holds three integer digits: 999,99 CLP at most. The catalogue does not live there — a Profoto
-- B10 is 900.000 CLP and a Canon R5 4.000.000 CLP
-- (src/services/__tests__/serialisedAssetService.test.ts) — so the seed below would overflow the
-- column and abort the whole transaction. numeric(12,2) holds up to 9.999.999.999,99 CLP, two
-- orders of magnitude above any body in the catalogue, and keeps the two decimals that were
-- asked for. The scale is a shape, not a budget.
--
-- SEED. `products.market_value_clp` is already a PER-UNIT figure ("Valor Mercado (CLP)" of the
-- client's count spreadsheet, 0010), so it is the correct starting point for a unit of that model.
-- The UPDATE only fills units whose market_price IS NULL, so a price an operator has already
-- edited is never overwritten and a replay of the migration is a no-op.
--
-- NO FUTURE-DATE CONSTRAINT. "The purchase date is not in the future" is a rule about now, and
-- Postgres only accepts immutable expressions in a CHECK: a CHECK on CURRENT_DATE is rejected when
-- the constraint is created. That rule belongs to the Service layer (T2), which owns validation.
--
-- PRIVILEGES. None. A new column inherits the table's grants, and `serialised_assets` is
-- service_role only since 0004. hermes_ro gains nothing, exactly as with 0006's acquisition_cost.
--
-- LOCKING. Two nullable ADD COLUMNs with no default: catalog-only, no rewrite. ACCESS EXCLUSIVE
-- on serialised_assets for milliseconds.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, and the CHECK is dropped and re-added under its name.
--
-- Apply with:  psql -U supabase_admin -v ON_ERROR_STOP=1 -f <this file>
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- =========================================================================
-- ROLE GUARD (prod-parity audit, 2026-08-19). Runs FIRST, inside the transaction. See 0002/0004/
-- 0006-0012: production's `public` relations are owned by `supabase_admin`, and `postgres` there
-- is neither superuser nor a member of that role. ALTER TABLE ... ADD COLUMN requires ownership,
-- so a wrong-role apply fails with a bare permission error unless this guard turns it into an
-- actionable message.
-- =========================================================================
DO $role_guard$
BEGIN
  IF NOT pg_has_role(current_user, 'supabase_admin', 'USAGE') THEN
    RAISE EXCEPTION
      'Esta migracion debe ejecutarse como supabase_admin (rol actual: %). Las relaciones de public '
      'pertenecen a supabase_admin: ALTER TABLE ... ADD COLUMN exige ser dueno de la tabla.',
      current_user
      USING HINT = 'psql -U supabase_admin -v ON_ERROR_STOP=1 -f <archivo>';
  END IF;
END
$role_guard$;

-- =========================================================================
-- The two columns. Nullable, no default: NULL is "not entered yet".
-- =========================================================================
ALTER TABLE public.serialised_assets
    ADD COLUMN IF NOT EXISTS purchase_date date;

ALTER TABLE public.serialised_assets
    ADD COLUMN IF NOT EXISTS market_price numeric(12,2);

-- =========================================================================
-- The bound. One named CHECK so a violation names the field the operator mistyped. Dropped and
-- re-added under the same name: Postgres has no ADD CONSTRAINT IF NOT EXISTS, and a renamed
-- constraint would otherwise be silently left in place (same reasoning as 0021's condition CHECK).
-- =========================================================================
ALTER TABLE public.serialised_assets
    DROP CONSTRAINT IF EXISTS serialised_assets_market_price_check;
ALTER TABLE public.serialised_assets
    ADD CONSTRAINT serialised_assets_market_price_check
    CHECK (market_price IS NULL OR market_price >= 0);

-- =========================================================================
-- Seed the market price from the model. `products.market_value_clp` is a per-unit figure, so it
-- is the right starting point for a unit of that model. Only units without a price are touched:
-- an operator's own value survives, and re-running the migration changes nothing.
-- =========================================================================
UPDATE public.serialised_assets sa
   SET market_price = p.market_value_clp
  FROM public.products p
 WHERE p.id = sa.product_id
   AND sa.market_price IS NULL
   AND p.market_value_clp IS NOT NULL;

-- =========================================================================
-- Comments. acquisition_cost already carried one from 0006; it is restated here because 0023 is
-- what puts that column in front of an operator, and a column nobody can read has no comment
-- worth keeping.
-- =========================================================================
COMMENT ON COLUMN public.serialised_assets.purchase_date IS
    'Fecha de compra de esta unidad. NULL = todavia no registrada. 0023.';
COMMENT ON COLUMN public.serialised_assets.market_price IS
    'Precio de mercado de esta unidad, en pesos chilenos. Semilla: products.market_value_clp del '
    'modelo. NULL = todavia no registrado. 0023.';
COMMENT ON COLUMN public.serialised_assets.acquisition_cost IS
    'Costo de adquisicion del activo fisico, en pesos chilenos, para margen/ROI. T-026 gap 3 '
    '(Opcion A, alcance minimo). 0023 lo expone en el contrato de unidades (InventoryUnit).';

-- =========================================================================
-- End-state assertion, inside the transaction: any miss rolls the whole migration back.
-- =========================================================================
DO $assert_0023$
DECLARE
    valuation_columns integer;
BEGIN
    SELECT count(*) INTO valuation_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'serialised_assets'
      AND column_name IN ('purchase_date', 'market_price');

    IF valuation_columns <> 2 THEN
        RAISE EXCEPTION
            'Abortado: se esperaban 2 columnas de valuacion en public.serialised_assets y hay %',
            valuation_columns;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'serialised_assets_market_price_check'
          AND conrelid = 'public.serialised_assets'::regclass
          -- Postgres stores the bound as `market_price >= (0)::numeric`, so match the operator only.
          AND pg_get_constraintdef(oid) LIKE '%market_price >= %'
    ) THEN
        RAISE EXCEPTION
            'Abortado: la restriccion serialised_assets_market_price_check no esta vigente';
    END IF;

    -- The seed ran: no unit of a valued model is left without a market price.
    IF EXISTS (
        SELECT 1
        FROM public.serialised_assets sa
        JOIN public.products p ON p.id = sa.product_id
        WHERE sa.market_price IS NULL
          AND p.market_value_clp IS NOT NULL
    ) THEN
        RAISE EXCEPTION
            'Abortado: hay unidades sin precio de mercado cuyo modelo si tiene valor de mercado';
    END IF;
END
$assert_0023$;

COMMIT;

-- =========================================================================
-- Post-apply checks.
--
--   SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'serialised_assets'
--      AND column_name IN ('purchase_date', 'market_price', 'acquisition_cost');
--   -- expect: date | NULL | NULL | YES
--   --         numeric | 12 | 2 | YES
--   --         numeric | NULL | NULL | YES
--
--   SELECT count(*) FROM public.serialised_assets
--    WHERE market_price IS NOT NULL;               -- the seeded units
--
--   SELECT p.name, sa.asset_tag, sa.market_price, p.market_value_clp
--     FROM public.serialised_assets sa
--     JOIN public.products p ON p.id = sa.product_id
--    WHERE sa.market_price IS DISTINCT FROM p.market_value_clp;
--   -- expect 0 rows, unless an operator already edited a unit's price
--
-- PostgREST caches the schema; reload it so the new columns are reachable:
--
--   NOTIFY pgrst, 'reload schema';
-- =========================================================================
