--
-- 0018_orders_return_report.sql — the reception report of a closed return (R-04b).
--
-- WHY. "Finalizar devolución" (Check-In and Bodega share one reception panel) records each line's
-- state — Recibido / Incompleto / Dañado / No entregado — with an incident type and note. Only
-- serialised units had somewhere to keep that (`asset_movements.condition_notes`); an incident on
-- a line without serial numbers was lost when the page closed.
--
-- SHAPE. One jsonb document per order, written once when the return is closed:
--   { "finalized_at": timestamptz-iso, "finalized_by": auth uid | null,
--     "lines": [ { "key", "label", "state", "incident_type", "note" } ] }
-- Validated by the application before it is written (`parseReturnReportLines`,
-- `lib/checkInReception.ts`); the CHECK below only guarantees it is an object with a `lines`
-- array, so a hand-written UPDATE cannot store something the panel could never read.
-- A column, not a table: the report is read with its order and never queried by line yet.
--
-- PRIVILEGES. A new column inherits the table's grants; `orders` writes go through the
-- service-role client, so no GRANT is needed.
--
-- COMPATIBILITY. The application writes it only from `OrderLifecycleService.saveReturnReport`,
-- which turns "column does not exist" into a warning: closing a return works before and after
-- this migration.
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
    ADD COLUMN IF NOT EXISTS return_report jsonb NULL;

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_return_report_shape;
ALTER TABLE public.orders
    ADD CONSTRAINT orders_return_report_shape
    CHECK (
        return_report IS NULL
        OR (jsonb_typeof(return_report) = 'object'
            AND jsonb_typeof(return_report -> 'lines') = 'array')
    );

COMMENT ON COLUMN public.orders.return_report IS
    'Reception report written when a return is closed: finalized_at, finalized_by, lines[{key,label,state,incident_type,note}]. R-04b.';

COMMIT;

-- Post-apply check:
--
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'return_report';
