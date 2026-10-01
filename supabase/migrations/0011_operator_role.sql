--
-- 0011_operator_role.sql — the `operator` role and an active flag on `admin_users` (garage
-- scanning dashboard, `/bodega`).
--
-- SDD artifacts (design.md, specs/*, audits/, rehearsals/) live at the mhans workspace root:
-- ../../../openspec/changes/consolidado-web-2027/ (OUTSIDE this repo — not visible from a clone
-- of `dashboard/` alone; see R2-003).
--
-- WHY A ROLE. Warehouse workers scan asset tags on the way out (checkout) and on the way back
-- (checkin). Every scan is signed by `asset_movements.checked_by_admin_id` (0006), and that
-- signature is only worth something if each worker has their OWN account — a shared admin login
-- would make the audit trail say "somebody". Workers need nothing else the dashboard offers:
-- no orders, no clients, no finance. `operator` names that narrow account. The gating itself
-- happens in the application (`src/lib/accessControl.ts`, applied by the global middleware and
-- `withAuth`), not in the database: the operator's requests still run through the service-role
-- client like every other dashboard request. This migration only makes the vocabulary explicit.
--
-- WHY A CHECK NOW. `admin_users.role` has carried no CHECK constraint since 0000 — verified on
-- the consolidado instance — and no code path inserts into the table (admins have been created
-- by hand). Batch 3 adds the first programmatic insert (`OperatorService.create`), so the column
-- gets its vocabulary pinned at the same time: a typo in a role name must fail loudly at write
-- time, not silently lock a worker out of every route.
--
-- WHY `is_active` AND NOT DELETE. Deleting an `admin_users` row nulls `checked_by_admin_id` on
-- every movement it signed (ON DELETE SET NULL, 0006). A worker who leaves must keep their name
-- on the scans they made; deactivation preserves the history and closes the door. Existing rows
-- default to active — nothing changes for the admins already in the table.
--
-- NO PRIVILEGE STATEMENT. `admin_users` keeps the grants 0000/0001/0002/0005 settled;
-- `hermes_ro` gains nothing here and holds nothing it did not before. Per the 0004–0010
-- convention: do not add a privilege statement without an ADR-D8 allowlist change and a matching
-- update to `hermes-mhans/scripts/assert-least-privilege.sh`.
--
-- LOCKING. `ADD COLUMN ... NOT NULL DEFAULT true` is catalog-only on Postgres 11+ (constant
-- default, no rewrite). The CHECK scans the table to validate existing rows — a handful. Both
-- take ACCESS EXCLUSIVE on `admin_users`, which `getServerAdmin` reads on every uncached
-- request, so `lock_timeout` makes a contended apply fail fast; re-run it.
--
-- Idempotent: `ADD COLUMN IF NOT EXISTS` plus a `pg_constraint` lookup for the CHECK, so a
-- partial apply can be replayed.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- =========================================================================
-- ROLE GUARD (prod-parity audit, 2026-08-19). Runs FIRST, inside the transaction. See 0002/0004/
-- 0006/0007/0008/0009/0010 for the full rationale: production's `public` relations are owned by
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
-- The active flag. Existing rows take the default: every current admin stays active.
-- =========================================================================
ALTER TABLE public.admin_users
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- =========================================================================
-- The role vocabulary, matching `ADMIN_ROLES` in `src/lib/accessControl.ts` exactly.
-- =========================================================================
DO $add_role_check$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'admin_users_role_check'
          AND conrelid = 'public.admin_users'::regclass
    ) THEN
        ALTER TABLE public.admin_users
            ADD CONSTRAINT admin_users_role_check
            CHECK (role IN ('admin', 'super_admin', 'operator'));
    END IF;
END
$add_role_check$;

COMMENT ON COLUMN public.admin_users.is_active IS
    'false = cuenta desactivada: no puede iniciar sesion ni usar la API. Se desactiva en vez de '
    'borrar para que los movimientos que firmo (asset_movements.checked_by_admin_id) conserven '
    'su autor.';

COMMENT ON CONSTRAINT admin_users_role_check ON public.admin_users IS
    'admin y super_admin: panel completo. operator: solo /bodega (escaneo de salidas y '
    'entradas). El control de acceso vive en la aplicacion (src/lib/accessControl.ts).';

COMMIT;

-- =========================================================================
-- Post-apply assertions.
--
--   SELECT role, is_active, count(*) FROM public.admin_users GROUP BY 1, 2 ORDER BY 1, 2;
--   -- every existing row: is_active = true
--
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'public.admin_users'::regclass AND conname = 'admin_users_role_check';
--
-- Privilege posture unchanged (must match the ADR-D8 allowlist, as before):
--
--   SELECT has_table_privilege('hermes_ro', 'public.admin_users', 'SELECT') AS ro_select;
--
-- PostgREST caches the schema; reload it so the new column is readable through the API:
--
--   NOTIFY pgrst, 'reload schema';
-- =========================================================================
