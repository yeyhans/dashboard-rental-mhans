--
-- 0024_relocation_source_mcp.down.sql — reverts 0024: only 'dashboard' and 'ops' origins.
--
-- Refuses to run while any row still says 'mcp': re-adding the two-value CHECK over such rows
-- would fail anyway, and silently rewriting the audit origin would be worse than failing.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

DO $role_guard$
BEGIN
  IF NOT pg_has_role(current_user, 'supabase_admin', 'USAGE') THEN
    RAISE EXCEPTION
      'Esta migracion debe ejecutarse como supabase_admin (rol actual: %).', current_user
      USING HINT = 'psql -U supabase_admin -v ON_ERROR_STOP=1 -f <archivo>';
  END IF;
END
$role_guard$;

DO $refuse_if_mcp$
BEGIN
  IF EXISTS (SELECT 1 FROM public.asset_relocations WHERE source = 'mcp') THEN
    RAISE EXCEPTION
      'No se puede revertir 0024: hay traslados con origen mcp. Reasignarlos antes de revertir.';
  END IF;
END
$refuse_if_mcp$;

ALTER TABLE public.asset_relocations
    DROP CONSTRAINT IF EXISTS asset_relocations_source_check;
ALTER TABLE public.asset_relocations
    ADD CONSTRAINT asset_relocations_source_check
    CHECK (source IN ('dashboard', 'ops'));

COMMIT;
