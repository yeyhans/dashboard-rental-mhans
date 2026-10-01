--
-- 0008_orders_reserve_config.sql — gives `orders` the two reserve columns the application has
-- been writing to all along.
--
-- SDD artifacts (design.md, specs/*, audits/, rehearsals/) live at the mhans workspace root:
-- ../../../openspec/changes/consolidado-web-2027/ (OUTSIDE this repo — not visible from a clone
-- of `dashboard/` alone; see R2-003).
--
-- WHY THIS IS A REPAIR, NOT A FEATURE. The per-order reserve was already built end to end:
--
--   * `src/components/orders/ProcessOrder.tsx:83-84` reads `orderData.reserve_type` and
--     `orderData.reserve_value`, renders a percent/fixed toggle, and PUTs the pair to
--     `/api/orders/update/[id]` (line 590).
--   * `src/components/payments/PaymentsTable.tsx:408-409` does the same from the payments table
--     and derives the displayed reserve with `calculateReserveAmount(total, type, value)` (line 96).
--   * `src/pages/api/orders/update/[id].ts:117-128` validates the pair — `percent|fixed`, numeric,
--     non-negative — and forwards it into the `orders` UPDATE.
--
-- The columns were never added. Every save therefore fails at the database with
-- `42703 column "reserve_type" of relation "orders" does not exist`, and every read falls back to
-- the hard-coded `'percent'` / `25`. The operator has been offered a setting that silently could
-- not be stored.
--
-- WHY THESE NAMES. They are not a fresh design decision: they are the contract already compiled
-- into the components and the endpoint. Adding a differently named column would leave that path
-- broken and create a second source of truth for the same number — which is the very defect this
-- work exists to remove. The wider cleanup (three separate `RESERVE_RATE` constants and twelve
-- loose `0.25` literals across dashboard and frontend) collapses onto these two columns.
--
-- DEFAULTS 'percent' / 25. Exactly the fallbacks both call sites already apply, and the share all
-- 499 existing orders were quoted at — their budget PDFs are already in customers' inboxes.
-- Defaulting to anything else would reprice invoiced history. Postgres 11+ fills a non-volatile
-- default from the catalog, so neither ADD COLUMN rewrites the table.
--
-- NOT NULL. Every read site treats the value as always-present. A nullable column would push a
-- NULL branch into the dashboard, the PDF generators and the customer portal independently —
-- three places free to drift apart again.
--
-- THE VALUE BOUND IS MODE-DEPENDENT. In `percent` mode the value is a share and cannot exceed 100;
-- in `fixed` mode it is an amount in CLP with no upper bound short of the order total, which this
-- constraint cannot see (the total lives in `calculated_total` and changes as items are edited —
-- enforcing `reserve_value <= calculated_total` here would reject legitimate edits made in either
-- order). The floor is `>= 0` rather than `> 0` to match what the endpoint already accepts at
-- line 125; a zero reserve is how the operator expresses "no deposit for this client", and
-- rejecting it in the database while the API accepts it would surface as an unexplained 500.
--
-- numeric(12,2), NOT a float. This value multiplies money. Binary floating point cannot represent
-- 33.33 exactly, and the error would land in a figure the customer reads on a PDF. The precision
-- covers a CLP amount well past any plausible order total.
--
-- LOCKING. Both `ADD COLUMN`s take ACCESS EXCLUSIVE on `orders` only long enough to update the
-- catalog — no row scan, because the defaults are constant. `orders` is written by live traffic,
-- so the `lock_timeout` below makes this fail fast rather than queue behind a long transaction and
-- block order writes. Re-run it if it times out.
--
-- SCOPE. Two columns and their CHECKs. No privilege statement and no RLS change: `orders` has RLS
-- disabled and its grants settled by 0000_baseline.sql and the 0001/0002/0005 chain, and widening
-- a table does not widen any grantee's surface. `hermes_ro` is untouched. Per the 0004/0006/0007
-- convention: do not add a privilege statement here without an ADR-D8 allowlist change and a
-- matching update to `hermes-mhans/scripts/assert-least-privilege.sh`.
--
-- Idempotent: `ADD COLUMN IF NOT EXISTS` plus `pg_constraint` lookups for the CHECKs (Postgres has
-- no `ADD CONSTRAINT IF NOT EXISTS`), so a partial apply can be replayed.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- =========================================================================
-- ROLE GUARD (prod-parity audit, 2026-08-19). Runs FIRST, inside the transaction. See 0002/0004/
-- 0006/0007 for the full rationale: production's `public` relations are owned by `supabase_admin`,
-- and `postgres` there is neither superuser nor a member of that role. `ALTER TABLE ... ADD
-- COLUMN` requires ownership of the table, so a wrong-role apply fails — this guard makes it fail
-- with an actionable message instead of a bare permission error.
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
-- The columns. Existing rows take the defaults, which are the terms they were invoiced under.
-- =========================================================================
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS reserve_type text NOT NULL DEFAULT 'percent';

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS reserve_value numeric(12,2) NOT NULL DEFAULT 25;

-- =========================================================================
-- The vocabulary, matching `/api/orders/update/[id].ts:118` exactly.
-- =========================================================================
DO $add_type_check$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'orders_reserve_type_check'
          AND conrelid = 'public.orders'::regclass
    ) THEN
        ALTER TABLE public.orders
            ADD CONSTRAINT orders_reserve_type_check
            CHECK (reserve_type IN ('percent', 'fixed'));
    END IF;
END
$add_type_check$;

-- =========================================================================
-- The amount bound. Mode-dependent: a percentage is capped at 100, a fixed amount is not.
-- =========================================================================
DO $add_value_check$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'orders_reserve_value_check'
          AND conrelid = 'public.orders'::regclass
    ) THEN
        ALTER TABLE public.orders
            ADD CONSTRAINT orders_reserve_value_check
            CHECK (
                reserve_value >= 0
                AND (reserve_type <> 'percent' OR reserve_value <= 100)
            );
    END IF;
END
$add_value_check$;

COMMENT ON COLUMN public.orders.reserve_type IS
    'Modo de la reserva: ''percent'' (porcentaje del total) o ''fixed'' (monto en CLP). Por defecto '
    '''percent'', que es el fallback que ya aplicaban ProcessOrder y PaymentsTable.';

COMMENT ON COLUMN public.orders.reserve_value IS
    'Valor de la reserva segun reserve_type: porcentaje 0-100, o monto en CLP. Por defecto 25 '
    '(regla de negocio). Fuente unica para el portal del cliente, los PDF y las tablas de cobranza.';

COMMIT;

-- =========================================================================
-- Post-apply assertion. Both columns must exist with the right types and defaults, both CHECKs
-- must be in place, and no existing order may have been repriced.
--
--   SELECT column_name, data_type, column_default, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'orders' AND column_name IN ('reserve_type', 'reserve_value');
--
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conname IN ('orders_reserve_type_check', 'orders_reserve_value_check');
--
--   SELECT count(*) FILTER (WHERE reserve_type = 'percent' AND reserve_value = 25) AS por_defecto,
--          count(*) AS total
--     FROM public.orders;   -- por_defecto must equal total right after the apply
--
-- PostgREST caches the schema, so the new columns stay invisible to the API — and the save path
-- stays broken — until reloaded. This is the step that actually makes the UI work:
--
--   NOTIFY pgrst, 'reload schema';
-- =========================================================================
