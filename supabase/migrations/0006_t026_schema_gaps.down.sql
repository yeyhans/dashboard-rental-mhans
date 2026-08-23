--
-- 0006_t026_schema_gaps.down.sql
--
-- SDD artifacts live at ../../../openspec/changes/consolidado-web-2027/ (outside this repo,
-- see R2-003).
--
-- Rollback for 0006_t026_schema_gaps.sql (ADR-D5 `.down.sql` convention).
--
-- DATA LOSS. `DROP TABLE public.asset_movements` erases every check-in/checkout record — the
-- audit trail of which physical unit went out on which order, nowhere else recorded (mirrors the
-- 0004 warning for `serialised_assets` itself). `DROP TABLE public.expenses` erases every logged
-- operational expense. Dropping the `shipping_usage` and `serialised_assets` columns erases
-- driver/delivery-payment data and per-unit acquisition cost respectively. Take a dump of all four
-- surfaces before running this on any environment where T-026 data has been entered.
--
-- Column drops run before table drops only where order matters for FKs; here it does not (both
-- dropped columns are on tables that are not being dropped), so order is chosen for readability:
-- undo gap 3, then gap 2, then gap 1, mirroring the forward migration in reverse.
--
-- Idempotent: IF EXISTS / IF NOT EXISTS throughout, so a re-run is safe.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- ---- gap 3 ----
DROP TABLE IF EXISTS public.expenses;

ALTER TABLE public.serialised_assets
    DROP COLUMN IF EXISTS acquisition_cost;

-- ---- gap 2 ----
ALTER TABLE public.shipping_usage
    DROP COLUMN IF EXISTS driver_name,
    DROP COLUMN IF EXISTS driver_phone,
    DROP COLUMN IF EXISTS delivery_payment_status,
    DROP COLUMN IF EXISTS delivery_payment_amount;

-- ---- gap 1 / 4 ----
DROP TABLE IF EXISTS public.asset_movements;

COMMIT;
