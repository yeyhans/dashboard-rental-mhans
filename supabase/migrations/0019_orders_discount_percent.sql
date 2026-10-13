--
-- 0019_orders_discount_percent.sql — percentage discount on an order without a coupon (R-05).
--
-- WHY. The client asked for "descuento en la orden por % sin necesidad de cupón". The manual
-- discount was a flat CLP amount only. A percentage has to be remembered as a percentage: when
-- the items or the dates change, the discount must follow the new subtotal, which a stored amount
-- cannot do.
--
-- SHAPE. numeric(5,2), nullable. NULL = no manual percentage (a flat amount, a coupon, or no
-- discount). The applied amount still lives in `calculated_discount`, recomputed on the server
-- from this column (`computeOrderTotals`, `lib/pricing.ts`), so every total, IVA and reserve
-- formula is unchanged. Base and rounding are the ones a percent coupon uses: products subtotal,
-- half-up to whole CLP; shipping is never discounted. A coupon still takes precedence.
--
-- PRIVILEGES. A new column inherits the table's grants; `orders` writes go through the
-- service-role client, so no GRANT is needed.
--
-- COMPATIBILITY. The edit route retries without `discount_percent` when the column does not exist
-- and answers with a warning, so the panel works before and after this migration.
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

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) NULL;

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_discount_percent_range;
ALTER TABLE public.orders
    ADD CONSTRAINT orders_discount_percent_range
    CHECK (discount_percent IS NULL OR (discount_percent > 0 AND discount_percent <= 100));

COMMENT ON COLUMN public.orders.discount_percent IS
    'Manual percentage discount over the products subtotal, without a coupon. NULL = none. The amount is calculated_discount. R-05.';

COMMIT;

-- Post-apply check:
--
--   SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'discount_percent';
