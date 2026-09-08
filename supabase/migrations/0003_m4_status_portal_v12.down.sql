-- =====================================================================================
--  0003 ROLLBACK — restore the pre-v1.2 status vocabulary.
--
--  SCOPE OF THE GUARANTEE. This file is exact ONLY inside the zero-post-cutover-write window:
--  it restores `(id, status)` verbatim from `orders_status_backup_20260817`, so any legitimate
--  status write made after the forward migration's COMMIT is silently discarded.
--
--  Once an admin has advanced an order through Área 01, or Hermes has recorded a transition, do
--  NOT run this unmodified. The spec (order-state-machine, "Late rollback requires reconciliation")
--  requires diffing post-cutover writes against the snapshot, mapping each v1.2 value back to its
--  nearest legacy equivalent, and recording which orders were reconciled versus blindly restored.
--  The guard below refuses the blind path when it detects post-cutover writes.
--
--  Apply with:
--    psql -U supabase_admin -v ON_ERROR_STOP=1 -f 0003_m4_status_portal_v12.down.sql
--
--  To accept the loss deliberately, set the GUC at connect time:
--    PGOPTIONS='-c mhans.allow_lossy_rollback=1' \
--      psql -U supabase_admin -v ON_ERROR_STOP=1 -f 0003_m4_status_portal_v12.down.sql
--
--  It must be PGOPTIONS (or a SET in the same session), NOT psql's `-v`. An earlier draft read
--  `current_setting('psql.allow_lossy_rollback')` and documented `-v allow_lossy_rollback=1`;
--  those are unrelated — `-v` sets a psql CLIENT variable that the server never sees — so the
--  override silently did nothing and the escape hatch could not be used at all. Caught by running
--  it against staging on 2026-08-19, not by reading it.
-- =====================================================================================

SET lock_timeout = '5s';
SET statement_timeout = '60s';

BEGIN;

-- =========================================================================
-- ROLE GUARD. Same reason as the forward migration: `public.orders` is owned by `supabase_admin`
-- in production, and as `postgres` the ALTER TABLE statements below fail while a REVOKE would
-- report success and do nothing.
-- =========================================================================
DO $role_guard$
BEGIN
  IF NOT pg_has_role(current_user, 'supabase_admin', 'USAGE') THEN
    RAISE EXCEPTION
      'Este rollback debe ejecutarse como supabase_admin (rol actual: %).',
      current_user
      USING HINT = 'psql -U supabase_admin -v ON_ERROR_STOP=1 -f <archivo>';
  END IF;
END
$role_guard$;

-- =========================================================================
-- 1. The snapshot must exist. Without this the UPDATE below joins an empty set, touches zero rows
--    and reports success — a rollback that says it restored 464 orders and restored none.
-- =========================================================================
DO $assert_backup$
DECLARE
  backed_up integer;
  live      integer;
BEGIN
  IF to_regclass('public.orders_status_backup_20260817') IS NULL THEN
    RAISE EXCEPTION
      'Abortado: no existe public.orders_status_backup_20260817. Sin el snapshot no hay inverso '
      'exacto: failed, cancelled y refunded colapsan los tres en cancelled y no se pueden '
      'distinguir a posteriori.';
  END IF;

  SELECT count(*) INTO backed_up FROM public.orders_status_backup_20260817;
  SELECT count(*) INTO live      FROM public.orders;

  IF backed_up = 0 THEN
    RAISE EXCEPTION 'Abortado: el snapshot existe pero esta vacio.';
  END IF;

  -- Orders created after the cutover have no snapshot row. That is expected, not an error, but it
  -- must be visible: those rows keep their v1.2 status and will violate the restored constraint.
  IF live > backed_up THEN
    RAISE NOTICE
      'Aviso: % orden(es) no estan en el snapshot (creadas despues del corte). Se mapean por '
      'equivalencia inversa, no por restauracion exacta.', live - backed_up;
  END IF;
END
$assert_backup$;

-- =========================================================================
-- 2. Refuse the blind path if any order was legitimately written after the cutover.
--
--    Detection: a row whose current status differs from what the forward mapping would have
--    produced from its snapshot value. That can only happen if something wrote it after COMMIT.
-- =========================================================================
DO $assert_no_post_cutover_writes$
DECLARE
  drifted integer;
BEGIN
  SELECT count(*) INTO drifted
  FROM public.orders o
  JOIN public.orders_status_backup_20260817 b ON b.id = o.id
  WHERE o.status IS DISTINCT FROM CASE b.status
                                    WHEN 'completed'  THEN 'completed'
                                    WHEN 'cancelled'  THEN 'cancelled'
                                    WHEN 'failed'     THEN 'cancelled'
                                    WHEN 'on-hold'    THEN 'request'
                                    WHEN 'processing' THEN 'confirmed'
                                    WHEN 'pending'    THEN 'request'
                                    WHEN 'refunded'   THEN 'cancelled'
                                  END;

  IF drifted > 0 AND current_setting('mhans.allow_lossy_rollback', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION
      'Abortado: % orden(es) recibieron una escritura de estado despues del corte. Restaurar el '
      'snapshot a ciegas descartaria esas escrituras.',
      drifted
      USING HINT = 'Ejecutar el procedimiento de reconciliacion, o repetir con '
                   'PGOPTIONS=''-c mhans.allow_lossy_rollback=1'' para aceptar la perdida de forma explicita.';
  END IF;

  IF drifted > 0 THEN
    RAISE WARNING
      'Rollback con perdida aceptado explicitamente: se descartan escrituras en % orden(es).',
      drifted;
  END IF;
END
$assert_no_post_cutover_writes$;

-- =========================================================================
-- 3. Drop the v1.2 constraint before restoring legacy values, or every UPDATE below violates it.
-- =========================================================================
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- =========================================================================
-- 4. Restore verbatim from the snapshot. Not a reverse CASE: the forward mapping is not
--    injective, so only the snapshot knows whether a `cancelled` row was once `failed`.
-- =========================================================================
UPDATE public.orders o
SET status = b.status
FROM public.orders_status_backup_20260817 b
WHERE o.id = b.id
  AND o.status IS DISTINCT FROM b.status;

-- Orders created after the cutover have no snapshot row. Map them back by nearest legacy
-- equivalent so the restored constraint can be applied at all.
UPDATE public.orders o
SET status = CASE o.status
               WHEN 'request'     THEN 'on-hold'
               WHEN 'evaluation'  THEN 'on-hold'
               WHEN 'confirmed'   THEN 'processing'
               WHEN 'preparation' THEN 'processing'
               WHEN 'in-rental'   THEN 'processing'
               WHEN 'return'      THEN 'processing'
               WHEN 'completed'   THEN 'completed'
               WHEN 'cancelled'   THEN 'cancelled'
               ELSE 'on-hold'
             END
WHERE NOT EXISTS (
  SELECT 1 FROM public.orders_status_backup_20260817 b WHERE b.id = o.id
);

-- =========================================================================
-- 5. Restore the prior constraint, with the seven legacy values.
-- =========================================================================
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed'));

-- =========================================================================
-- 6. Undo the schema additions, so a re-apply starts from the pre-migration shape.
-- =========================================================================
ALTER TABLE public.orders DROP COLUMN IF EXISTS cancellation_reason;

DROP TABLE IF EXISTS public.orders_status_backup_20260817;

COMMIT;

-- =========================================================================
--  Post-rollback assertions. Both MUST hold.
--
--  SELECT count(*) FROM public.orders
--   WHERE status NOT IN ('pending','processing','on-hold','completed','cancelled','refunded','failed'); -- 0
--
--  SELECT count(*) FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='orders' AND column_name='cancellation_reason';          -- 0
-- =========================================================================
