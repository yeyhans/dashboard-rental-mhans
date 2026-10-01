-- =====================================================================================
--  0003 — M4: migrate orders.status to the Portal Cliente v1.2 vocabulary (ADR-001).
--  Spec: openspec/changes/consolidado-web-2027/specs/order-state-machine/spec.md
--
--  Replaces the live seven-value CHECK with the canonical eight:
--      request, evaluation, confirmed, preparation, in-rental, return, completed, cancelled
--
--  MAPPING (covers every value the live constraint permits, not just the ones with rows):
--
--      completed   -> completed
--      cancelled   -> cancelled
--      failed      -> cancelled   + cancellation_reason
--      on-hold     -> request
--      processing  -> confirmed
--      pending     -> request
--      refunded    -> cancelled   + cancellation_reason
--
--  `pending` and `refunded` hold zero rows today. They are mapped anyway because the live
--  constraint admits them and the business is still taking orders: a row arriving with one of
--  those values between authoring and applying would otherwise hit the `NOT IN` guard below and
--  abort the migration in the middle of the maintenance window.
--
--  WHY A BACKUP TABLE AND NOT A REVERSE CASE. Three source values (`failed`, `cancelled`,
--  `refunded`) collapse into `cancelled`, so the mapping is not injective and no reverse CASE can
--  restore the original. `.down.sql` reads the `(id, status)` snapshot this migration takes, which
--  is the only exact inverse — and only inside the zero-post-cutover-write window the spec
--  describes. Past that point, see the reconciliation requirement in the spec; `.down.sql` alone
--  would silently discard legitimate post-cutover writes.
--
--  ORDERING NOTE. This creates a table in `public`, so it must sit after `0002` (hermes
--  least-privilege) — `lint-chain.sh` rule 1 enforces that — and it must revoke anon itself,
--  because `pg_default_acl` still grants anon the full table privilege set until `0005` lands and
--  this migration may be applied before it.
--
--  Apply with:  psql -U supabase_admin -v ON_ERROR_STOP=1 -f 0003_m4_status_portal_v12.sql
-- =====================================================================================

SET lock_timeout = '5s';
SET statement_timeout = '60s';

BEGIN;

-- =========================================================================
-- ROLE GUARD (prod-parity audit, 2026-08-19). Runs FIRST, inside the transaction.
--
-- Every relation in production's `public` schema is owned by `supabase_admin`, and the `postgres`
-- role there is NOT a superuser and NOT a member of `supabase_admin`. Executed as `postgres`, this
-- migration's ALTER TABLE and CREATE POLICY statements error outright, and a bare REVOKE would
-- return the `REVOKE` tag with only a WARNING while changing nothing.
--
-- Apply with:  psql -U supabase_admin -v ON_ERROR_STOP=1 -f <this file>
-- =========================================================================
DO $role_guard$
BEGIN
  IF NOT pg_has_role(current_user, 'supabase_admin', 'USAGE') THEN
    RAISE EXCEPTION
      'Esta migracion debe ejecutarse como supabase_admin (rol actual: %). Las relaciones de public '
      'pertenecen a supabase_admin: como postgres, REVOKE informa exito y no revoca nada.',
      current_user
      USING HINT = 'psql -U supabase_admin -v ON_ERROR_STOP=1 -f <archivo>';
  END IF;
END
$role_guard$;

-- =========================================================================
-- 1. New column. Added before the UPDATE so the same statement can populate it.
-- =========================================================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_reason text;

COMMENT ON COLUMN public.orders.cancellation_reason IS
  'Por que se cancelo la orden. Obligatorio para las filas migradas desde failed o refunded: '
  'ambos colapsan en cancelled y sin esto la distincion se pierde.';

-- =========================================================================
-- 2. Pre-migration snapshot. MUST happen before the UPDATE — a snapshot taken afterwards records
--    the migrated values and `.down.sql` would restore the migration onto itself.
--
--    Not TEMP and not dropped at COMMIT: `.down.sql` runs in a later session and needs it. It is
--    dropped by `.down.sql`, or by hand once the rollback window has closed.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.orders_status_backup_20260817 (
  id     integer PRIMARY KEY,
  status text NOT NULL
);

-- pg_default_acl grants anon and authenticated the full table privilege set (arwdDxt, TRUNCATE
-- included) on every new table in public until 0005 revokes the default. This table holds the only
-- exact inverse of the migration, so an anon TRUNCATE here would destroy the rollback path.
REVOKE ALL ON TABLE public.orders_status_backup_20260817 FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orders_status_backup_20260817 TO service_role;

ALTER TABLE public.orders_status_backup_20260817 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages the status backup"
  ON public.orders_status_backup_20260817;
CREATE POLICY "Service role manages the status backup"
  ON public.orders_status_backup_20260817
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Idempotent: a re-apply after a rollback re-populates from the (restored) live values.
INSERT INTO public.orders_status_backup_20260817 (id, status)
SELECT id, status FROM public.orders
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

-- =========================================================================
-- 3. Assert the constraint we are about to drop actually exists, under that name.
--
--    `DROP CONSTRAINT IF EXISTS` on a constraint that was renamed at some point is a silent no-op:
--    the migration would report success, add the new constraint alongside the old one, and leave
--    the legacy vocabulary still enforced. Checked explicitly rather than assumed.
-- =========================================================================
DO $assert_constraint$
DECLARE
  found integer;
BEGIN
  SELECT count(*) INTO found
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
    AND table_name = 'orders'
    AND constraint_name = 'orders_status_check'
    AND constraint_type = 'CHECK';

  IF found = 0 THEN
    RAISE EXCEPTION
      'Abortado: no existe la restriccion orders_status_check en public.orders. '
      'Fue renombrada o ya migrada; un DROP ... IF EXISTS aqui no haria nada y dejaria el '
      'vocabulario antiguo vigente.';
  END IF;
END
$assert_constraint$;

-- =========================================================================
-- 4. Drop the legacy constraint BEFORE writing v1.2 values.
--
--    Not a cosmetic ordering. A CHECK is evaluated per row at UPDATE time, so writing `request`
--    while the seven-value constraint is still attached fails on the first migrated row with
--      ERROR: new row for relation "orders" violates check constraint "orders_status_check"
--    The first draft of this file ordered it assert -> UPDATE -> DROP -> ADD, which parses fine
--    and passes every static assertion; the staging rehearsal on 2026-08-19 is what caught it.
--
--    The window between this DROP and the ADD at step 7 is the only moment `orders.status` is
--    unconstrained, and it is entirely inside this transaction.
-- =========================================================================
ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;

-- =========================================================================
-- 5. The mapping itself. One UPDATE writes both columns so a row can never end up with a v1.2
--    status and no reason, or a reason and an unmigrated status.
--
--    `cancellation_reason` is only written where it is NULL, so a re-apply after a partial
--    rollback does not overwrite a reason an admin has since edited.
-- =========================================================================
UPDATE public.orders
SET
  status = CASE status
             WHEN 'completed'  THEN 'completed'
             WHEN 'cancelled'  THEN 'cancelled'
             WHEN 'failed'     THEN 'cancelled'
             WHEN 'on-hold'    THEN 'request'
             WHEN 'processing' THEN 'confirmed'
             WHEN 'pending'    THEN 'request'
             WHEN 'refunded'   THEN 'cancelled'
           END,
  cancellation_reason = COALESCE(
    cancellation_reason,
    CASE status
      WHEN 'failed'   THEN 'Migrado desde el estado failed (v1.1)'
      WHEN 'refunded' THEN 'Migrado desde el estado refunded (v1.1)'
      ELSE NULL
    END
  )
WHERE status IN ('completed', 'cancelled', 'failed', 'on-hold', 'processing', 'pending', 'refunded');

-- =========================================================================
-- 6. Refuse to add the new constraint while any row is still outside the vocabulary.
--
--    Runs after the UPDATE and before ADD CONSTRAINT. Without it, `ADD CONSTRAINT` is what fails,
--    and its error names a constraint violation rather than the rows that caused it — a worse
--    thing to read at 03:00 in a maintenance window.
-- =========================================================================
DO $assert_vocabulary$
DECLARE
  stragglers integer;
BEGIN
  SELECT count(*) INTO stragglers
  FROM public.orders
  WHERE status IS NULL
     OR status NOT IN ('request', 'evaluation', 'confirmed', 'preparation',
                       'in-rental', 'return', 'completed', 'cancelled');

  IF stragglers > 0 THEN
    RAISE EXCEPTION
      'Abortado: % orden(es) quedaron fuera del vocabulario v1.2 despues del mapeo. '
      'Un valor permitido por la restriccion antigua no esta cubierto por el CASE.',
      stragglers;
  END IF;
END
$assert_vocabulary$;

-- =========================================================================
-- 7. Attach the v1.2 constraint.
-- =========================================================================
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN ('request', 'evaluation', 'confirmed', 'preparation', 'in-rental', 'return', 'completed', 'cancelled'));

COMMIT;

-- =========================================================================
--  Post-apply assertions (test-first artifact). All three MUST hold.
--
--  -- a) no row outside the vocabulary
--  SELECT count(*) FROM public.orders
--   WHERE status IS NULL OR status NOT IN ('request','evaluation','confirmed','preparation',
--                                          'in-rental','return','completed','cancelled');   -- 0
--
--  -- b) counts preserved through the mapping
--  SELECT b.status AS antes, o.status AS despues, count(*)
--    FROM public.orders_status_backup_20260817 b JOIN public.orders o ON o.id = b.id
--   GROUP BY 1, 2 ORDER BY 1;
--
--  -- c) every row migrated from failed/refunded carries a reason
--  SELECT count(*) FROM public.orders o JOIN public.orders_status_backup_20260817 b ON b.id = o.id
--   WHERE b.status IN ('failed','refunded') AND o.cancellation_reason IS NULL;                -- 0
-- =========================================================================
