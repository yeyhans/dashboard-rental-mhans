--
-- 0010_product_valuation.sql — declared quantity and valuation on `products` (serialised
-- inventory, the client's count spreadsheet).
--
-- SDD artifacts (design.md, specs/*, audits/, rehearsals/) live at the mhans workspace root:
-- ../../../openspec/changes/consolidado-web-2027/ (OUTSIDE this repo — not visible from a clone
-- of `dashboard/` alone; see R2-003).
--
-- WHY. The client's inventory spreadsheet carries five columns per model: "Cantidad", "Numero
-- serie", "Valor Mercado (CLP)", "Valor Usado (CLP)" and "Valor Total (CLP)". Mapping decided
-- with the client:
--
--   * "Numero serie" is the code that repeats per MODEL, not per unit — that is `products.sku`,
--     which already exists. The per-unit manufacturer serial stays in
--     `serialised_assets.serial_number` (0004). No column added for it.
--   * "Cantidad" is the quantity the client DECLARES owning → `declared_quantity`. The quantity
--     actually COUNTED is `count(*) FROM serialised_assets GROUP BY product_id`, and is not
--     stored: it is the physical count's own output. Both are shown side by side in the intake
--     dashboard, and a mismatch is a data-quality finding — that comparison is the point of
--     recording the declaration at all.
--   * "Valor Mercado (CLP)" → `market_value_clp`. "Valor Usado (CLP)" → `used_value_clp`.
--   * "Valor Total (CLP)" is NOT stored. It is `quantity * used_value_clp` with quantity = the
--     counted units when any exist, else the declared quantity (`src/lib/productValuation.ts`).
--     Persisting it would create a second source of truth that drifts the moment a unit is
--     counted or a value edited — the same defect 0008 exists to remove for the reserve.
--
-- WHY `integer`. CLP has no subunit in circulation; every price column the application formats
-- with `toLocaleString('es-CL')` rounds to the peso. `integer` tops out above 2,147 million
-- pesos, two orders of magnitude past any single item in the catalogue; a decimal type would
-- invite the ".00" the spreadsheet never carries.
--
-- WHY NULLABLE. These columns are filled model by model as the count proceeds. NULL means "not
-- yet entered"; 0 means "entered, and it is zero" (a written-off item still on the shelf). A NOT
-- NULL DEFAULT 0 would erase that distinction and make every unfilled row look valued.
--
-- CHECK `>= 0`. A negative quantity or value is a typo, never a fact. Named after their columns
-- and guarded by `pg_constraint` lookups (Postgres has no `ADD CONSTRAINT IF NOT EXISTS`).
--
-- NO PRIVILEGE STATEMENT. Widening a table does not widen any grantee's surface. `products` has
-- no RLS and its grants were settled by 0000/0001/0002/0005; `hermes_ro` keeps exactly what the
-- ADR-D8 allowlist grants it and gains nothing here. Per the 0004–0009 convention: do not add a
-- privilege statement without an allowlist change and a matching update to
-- `hermes-mhans/scripts/assert-least-privilege.sh`.
--
-- LOCKING. Three nullable `ADD COLUMN`s with no default: catalog-only, no rewrite. ACCESS
-- EXCLUSIVE on `products` for milliseconds. `products` is read by the public storefront, so the
-- `lock_timeout` makes a contended apply fail fast; re-run it.
--
-- Idempotent: `ADD COLUMN IF NOT EXISTS` plus `pg_constraint` lookups for the CHECKs, so a partial
-- apply can be replayed.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- =========================================================================
-- ROLE GUARD (prod-parity audit, 2026-08-19). Runs FIRST, inside the transaction. See 0002/0004/
-- 0006/0007/0008/0009 for the full rationale: production's `public` relations are owned by
-- `supabase_admin`, and `postgres` there is neither superuser nor a member of that role.
-- `ALTER TABLE ... ADD COLUMN` requires ownership, so a wrong-role apply fails — this guard makes
-- it fail with an actionable message instead of a bare permission error.
--
-- Apply with:  psql -U supabase_admin -v ON_ERROR_STOP=1 -f <this file>
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
-- The columns. Nullable, no default: NULL is "not entered yet".
-- =========================================================================
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS declared_quantity integer;

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS market_value_clp integer;

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS used_value_clp integer;

-- =========================================================================
-- The bounds. One named CHECK per column so a violation names the field the operator mistyped.
-- =========================================================================
DO $add_declared_quantity_check$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'products_declared_quantity_check'
          AND conrelid = 'public.products'::regclass
    ) THEN
        ALTER TABLE public.products
            ADD CONSTRAINT products_declared_quantity_check
            CHECK (declared_quantity IS NULL OR declared_quantity >= 0);
    END IF;
END
$add_declared_quantity_check$;

DO $add_market_value_check$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'products_market_value_clp_check'
          AND conrelid = 'public.products'::regclass
    ) THEN
        ALTER TABLE public.products
            ADD CONSTRAINT products_market_value_clp_check
            CHECK (market_value_clp IS NULL OR market_value_clp >= 0);
    END IF;
END
$add_market_value_check$;

DO $add_used_value_check$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'products_used_value_clp_check'
          AND conrelid = 'public.products'::regclass
    ) THEN
        ALTER TABLE public.products
            ADD CONSTRAINT products_used_value_clp_check
            CHECK (used_value_clp IS NULL OR used_value_clp >= 0);
    END IF;
END
$add_used_value_check$;

COMMENT ON COLUMN public.products.declared_quantity IS
    'Cantidad que el cliente declara poseer de este modelo (columna "Cantidad" de su planilla). '
    'La cantidad contada es count(serialised_assets) por product_id y no se almacena.';

COMMENT ON COLUMN public.products.market_value_clp IS
    'Valor de mercado por unidad en pesos chilenos, sin decimales ("Valor Mercado (CLP)").';

COMMENT ON COLUMN public.products.used_value_clp IS
    'Valor usado por unidad en pesos chilenos, sin decimales ("Valor Usado (CLP)"). El valor total '
    'no se almacena: se deriva como cantidad * used_value_clp en la aplicacion.';

COMMIT;

-- =========================================================================
-- Post-apply assertions.
--
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'products'
--      AND column_name IN ('declared_quantity', 'market_value_clp', 'used_value_clp');
--   -- expect three rows: integer | YES
--
-- Privilege posture unchanged for the agent role (must match the ADR-D8 allowlist, as before):
--
--   SELECT has_table_privilege('hermes_ro', 'public.products', 'SELECT') AS ro_select;
--
-- PostgREST caches the schema; reload it so the new columns are writable through the API:
--
--   NOTIFY pgrst, 'reload schema';
-- =========================================================================
