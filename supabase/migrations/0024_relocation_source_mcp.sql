--
-- 0024_relocation_source_mcp.sql — accept 'mcp' as the origin of a warehouse relocation.
--
-- Feature doc: odd/tasks/mcp-ubicaciones.md (T1). The shared TypeScript contract is
-- src/types/inventory.ts (RELOCATION_SOURCES), copied verbatim into mariohans-3d-ops.
--
-- WHY. 0021 declares asset_relocations.source as CHECK (source IN ('dashboard', 'ops')). The MCP
-- server now moves units on behalf of the team, and an audit row that says 'dashboard' for a move
-- made through Claude would hide who did it. This migration adds 'mcp' and nothing else.
--
-- WHAT. Drops and re-adds the one CHECK constraint on asset_relocations.source with the wider list.
-- Existing rows keep their values; every existing value stays valid.
--
-- LOCKING. Dropping and re-adding a CHECK takes ACCESS EXCLUSIVE on asset_relocations for the
-- duration of the validation scan. The table is small; lock_timeout makes a stuck apply fail fast.
--
-- Idempotent: DROP CONSTRAINT IF EXISTS, then ADD under the same name.
--
-- Apply with:  psql -U supabase_admin -v ON_ERROR_STOP=1 -f <this file>
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- =========================================================================
-- ROLE GUARD. Same reason as 0021/0023: asset_relocations is owned by supabase_admin, and ALTER
-- TABLE requires ownership. Run as postgres, a wrong-role apply would fail with a bare error.
-- =========================================================================
DO $role_guard$
BEGIN
  IF NOT pg_has_role(current_user, 'supabase_admin', 'USAGE') THEN
    RAISE EXCEPTION
      'Esta migracion debe ejecutarse como supabase_admin (rol actual: %). asset_relocations '
      'pertenece a supabase_admin: ALTER TABLE exige ser dueno de la tabla.',
      current_user
      USING HINT = 'psql -U supabase_admin -v ON_ERROR_STOP=1 -f <archivo>';
  END IF;
END
$role_guard$;

-- =========================================================================
-- The origin list. Dropped and re-added under the same name so a rename can never leave the old
-- two-value CHECK in place (same reasoning as 0023's market_price bound).
-- =========================================================================
ALTER TABLE public.asset_relocations
    DROP CONSTRAINT IF EXISTS asset_relocations_source_check;
ALTER TABLE public.asset_relocations
    ADD CONSTRAINT asset_relocations_source_check
    CHECK (source IN ('dashboard', 'ops', 'mcp'));

COMMENT ON COLUMN public.asset_relocations.source IS
    'Origen del traslado: dashboard (administración), ops (centro 3D) o mcp (agente del equipo). 0024.';

-- =========================================================================
-- End-state assertion: the new value is accepted and the old ones still are. Any miss rolls back.
-- Postgres prints the list back as `source = ANY (ARRAY['dashboard', 'ops', 'mcp'])`, so match the
-- literal values, not the spelling of the original CHECK.
-- =========================================================================
DO $assert_0024$
DECLARE
    definition text;
BEGIN
    SELECT pg_get_constraintdef(oid) INTO definition
    FROM pg_constraint
    WHERE conname = 'asset_relocations_source_check'
      AND conrelid = 'public.asset_relocations'::regclass;

    IF definition IS NULL THEN
        RAISE EXCEPTION 'Abortado: no existe asset_relocations_source_check';
    END IF;
    IF definition NOT LIKE '%''mcp''%' OR definition NOT LIKE '%''dashboard''%' OR definition NOT LIKE '%''ops''%' THEN
        RAISE EXCEPTION 'Abortado: asset_relocations_source_check no tiene los tres origenes: %', definition;
    END IF;
END
$assert_0024$;

COMMIT;

-- =========================================================================
-- Post-apply checks.
--
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'asset_relocations_source_check';
--   -- expect: CHECK (source = ANY (ARRAY['dashboard', 'ops', 'mcp']))
--
-- PostgREST caches the schema; a CHECK change does not need a reload, but reloading is harmless:
--
--   NOTIFY pgrst, 'reload schema';
-- =========================================================================
