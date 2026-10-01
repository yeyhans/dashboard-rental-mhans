--
-- 0007_shipping_usage_order_fk.sql — adds the missing foreign key
-- `shipping_usage.order_id -> orders(id)`.
--
-- SDD artifacts (design.md, specs/*, audits/, rehearsals/) live at the mhans workspace root:
-- ../../../openspec/changes/consolidado-web-2027/ (OUTSIDE this repo — not visible from a clone
-- of `dashboard/` alone; see R2-003).
--
-- WHY. `DeliveryService.getBoard` (`src/services/deliveryService.ts:78-87`) loads the whole
-- Delivery board with one PostgREST query that embeds the order inside the shipment row:
--
--     .from('shipping_usage')
--     .select('id, order_id, ..., orders (order_key, order_proyecto, ...)')
--
-- PostgREST resolves an embedded resource by looking for a foreign key between the two relations.
-- `shipping_usage` has carried a UNIQUE constraint on `order_id` since 0000_baseline.sql, but
-- never an FK, so there is no relationship for PostgREST to resolve: the request errors and the
-- entire `/delivery` module renders empty. The UNIQUE alone does not help — uniqueness is not a
-- referential relationship. This migration supplies the FK the embed requires; it is a
-- correctness fix for a broken module, not schema tidying.
--
-- ON DELETE RESTRICT, following the reasoning 0006 wrote for `asset_movements`' order FK: a
-- shipping_usage row is the record that a physical delivery happened against an order (cost,
-- tracking number, driver, delivery payment — the last two added by 0006 gap 2). Deleting the
-- order must not make that record vanish silently. RESTRICT forces the operator to deal with the
-- shipment explicitly. This differs from `expenses.related_order_id` (0006), which is SET NULL
-- because an expense is meaningful standalone; a shipment without its order is not.
--
-- ORPHAN BACKFILL: NONE NEEDED HERE, BUT ASSERTED ANYWAY. At authoring time `shipping_usage` was
-- empty in the consolidado database (0 rows), so no row can violate the new constraint and no
-- backfill or cleanup step is required. That fact is true of the consolidado only — this same file
-- is expected to be applied to production later, where the table may hold rows. The DO block below
-- therefore counts orphans first and raises before the ALTER runs, so a production apply fails
-- loudly with a count instead of surfacing a bare `23503 insert or update on table ... violates
-- foreign key constraint` from the constraint validation. Both outcomes abort the transaction; the
-- difference is that the operator learns how many rows are wrong and can go fix them.
--
-- LOCKING. `ADD CONSTRAINT ... FOREIGN KEY` takes ACCESS EXCLUSIVE on `shipping_usage` and
-- SHARE ROW EXCLUSIVE on `orders` for the duration of the validating scan. Both tables are small
-- (hundreds of rows), so the scan is instantaneous, but `orders` is written by live traffic — the
-- `lock_timeout` below makes this fail fast rather than queue behind a long transaction and block
-- order writes. Re-run it if it times out.
--
-- NO INDEX ADDED. An FK's own referential checks on the referencing side are served by the
-- existing UNIQUE index on `shipping_usage.order_id` (0000_baseline.sql); a second index on the
-- same single column would be dead weight.
--
-- SCOPE. Schema shape only. No privilege statement and no RLS/policy change: `shipping_usage`
-- already has RLS enabled and its privileges settled by 0000_baseline.sql and the 0001/0002/0005
-- chain, and a constraint does not widen any grantee's surface. `hermes_ro` is untouched —
-- `shipping_usage` was never on the 0002 hermes_ro allowlist (8 relations, this is not one of
-- them), and this migration does not put it there. Per the 0004/0006 convention: do not add a
-- privilege statement here without an ADR-D8 allowlist change and a matching update to
-- `hermes-mhans/scripts/assert-least-privilege.sh`.
--
-- Idempotent: the constraint is added only if `pg_constraint` does not already hold it (Postgres
-- has no `ADD CONSTRAINT IF NOT EXISTS`), so a partial apply can be replayed.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- =========================================================================
-- ROLE GUARD (prod-parity audit, 2026-08-19). Runs FIRST, inside the transaction. See 0002/0004/
-- 0006 for the full rationale: production's `public` relations are owned by `supabase_admin`, and
-- `postgres` there is neither superuser nor a member of that role. `ALTER TABLE ... ADD
-- CONSTRAINT` requires ownership of the table, so a wrong-role apply fails — this guard makes it
-- fail with an actionable message instead of a bare permission error.
--
-- Apply with:  psql -U supabase_admin -v ON_ERROR_STOP=1 -f <this file>
-- =========================================================================
DO $role_guard$
BEGIN
  IF NOT pg_has_role(current_user, 'supabase_admin', 'USAGE') THEN
    RAISE EXCEPTION
      'Esta migracion debe ejecutarse como supabase_admin (rol actual: %). Las relaciones de public '
      'pertenecen a supabase_admin: ALTER TABLE ... ADD CONSTRAINT exige ser dueno de la tabla.',
      current_user
      USING HINT = 'psql -U supabase_admin -v ON_ERROR_STOP=1 -f <archivo>';
  END IF;
END
$role_guard$;

-- =========================================================================
-- PRE-FLIGHT: no orphan shipments. Defensive — the consolidado table was empty when this was
-- written, but production may not be. Raises with the offending count before the constraint is
-- attempted, so the failure names the problem instead of the symptom.
-- =========================================================================
DO $orphan_check$
DECLARE
    orphan_count integer;
BEGIN
    SELECT count(*) INTO orphan_count
    FROM public.shipping_usage su
    WHERE su.order_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM public.orders o WHERE o.id = su.order_id
      );

    IF orphan_count > 0 THEN
        RAISE EXCEPTION
          'shipping_usage tiene % fila(s) con order_id sin orden correspondiente. Corregir o '
          'eliminar esas filas antes de aplicar la FK.', orphan_count
          USING HINT = 'SELECT su.id, su.order_id FROM public.shipping_usage su '
                       'LEFT JOIN public.orders o ON o.id = su.order_id '
                       'WHERE su.order_id IS NOT NULL AND o.id IS NULL;';
    END IF;
END
$orphan_check$;

-- =========================================================================
-- The foreign key. Guarded by a pg_constraint lookup for idempotency.
-- =========================================================================
DO $add_fk$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'shipping_usage_order_id_fkey'
          AND conrelid = 'public.shipping_usage'::regclass
    ) THEN
        ALTER TABLE public.shipping_usage
            ADD CONSTRAINT shipping_usage_order_id_fkey
            FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;
    END IF;
END
$add_fk$;

COMMENT ON CONSTRAINT shipping_usage_order_id_fkey ON public.shipping_usage IS
    'Relacion 1:1 despacho-orden (UNIQUE order_id). Requerida por el embed PostgREST de DeliveryService.getBoard.';

COMMIT;

-- =========================================================================
-- Post-apply assertion. The constraint must exist and PostgREST must be able to see it. The
-- second query is what actually matters for `/delivery`: PostgREST reads its relationship map
-- from the catalog, so a schema-cache reload (NOTIFY pgrst, 'reload schema') is required after
-- this migration before the embed starts resolving.
--
--   SELECT conname, confdeltype
--     FROM pg_constraint
--    WHERE conname = 'shipping_usage_order_id_fkey';   -- confdeltype must be 'r' (RESTRICT)
--
--   NOTIFY pgrst, 'reload schema';
-- =========================================================================
