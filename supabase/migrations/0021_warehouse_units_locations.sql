--
-- 0021_warehouse_units_locations.sql — inventory canon RC2.1.3: unit wear and the `blocked`
-- condition, a structured warehouse location model, an append-only relocation log, incident types
-- on movements, per-product unit counts, and optimistic concurrency on units and locations.
--
-- Feature doc: odd/tasks/inventory-canon-units-locations.md (T1). Shared by the dashboard
-- (admins) and ops.mariohans.cl (operators); the TypeScript contract is src/types/inventory.ts.
--
-- WHAT.
--   serialised_assets
--     * wear text NOT NULL DEFAULT 'used' ('new' | 'used') — canon "Condición Nuevo/Usado".
--       Existing units default to 'used': nothing recorded them as new.
--     * condition CHECK gains 'blocked' (canon "Bloqueado"). "En arriendo" is NOT a condition:
--       it is derived from asset_current_state (0012) and never stored.
--     * location_id uuid NULL -> warehouse_locations ON DELETE RESTRICT. The legacy `location`
--       text stays NOT NULL and is DERIVED from location_id ("CODE · Name") by a BEFORE INSERT OR
--       UPDATE trigger whenever location_id is set; units without a location_id keep accepting
--       free-text writes (the intake form still writes text). The trigger fires on every update,
--       not only UPDATE OF location_id: a text-only write against a unit that has a location_id
--       would otherwise desync the two.
--     * row_version integer, bumped by a BEFORE UPDATE trigger. Writers update with
--       `.eq('row_version', expected)`; zero rows updated means someone else changed the unit.
--   warehouse_locations — the 5x5 m room: shelves (N/E/S/W walls), levels inside shelves, boxes
--     (on a shelf, a level, the floor or the rug), floor zones and the central rug. Geometry in
--     meters from the top-left corner. Only the rug is seeded; everything else is created from
--     the apps. A code/name change rewrites the derived text of the units stored there.
--   asset_relocations — append-only log of unit moves. Inserting a row IS the move: an AFTER
--     INSERT trigger sets serialised_assets.location_id = to_location_id only if the unit is still
--     at from_location_id, otherwise it raises SQLSTATE PT409 (PostgREST answers HTTP 409), so a
--     stale screen cannot move a unit somebody else already moved. Move + log are one statement.
--   asset_movements.incident_type — the check-in canon incident vocabulary.
--   product_unit_counts — one row per product (zero counts included). Buckets are mutually
--     exclusive for non-retired units: total = available + in_rental + maintenance + damaged +
--     blocked. A unit with an open checkout counts as in_rental whatever its condition.
--
-- ACTOR COLUMNS. updated_by / moved_by_admin_id are uuid -> admin_users(user_id) ON DELETE SET
-- NULL: both apps hold the auth uuid of the session, and removing an admin must not block on or
-- corrupt history (same reasoning as asset_movements.checked_by_admin_id in 0006).
--
-- PRIVILEGES. Same posture as 0004/0006/0012: nothing for PUBLIC/anon/authenticated, service_role
-- only (both apps reach these through their server-side service-role client), RLS enabled with a
-- service_role policy. asset_relocations is SELECT, INSERT only (append-only audit). hermes_ro
-- gains NOTHING: locations are inventory-security data. Do not add a grant without an ADR-D8
-- allowlist change and a matching update to hermes-mhans/scripts/assert-least-privilege.sh.
-- New functions pin search_path and revoke EXECUTE from PUBLIC (0020 F5 limitation note). None is
-- SECURITY DEFINER: they run as the writer, which already holds the table privileges.
--
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS before CREATE TRIGGER /
-- ON CONFLICT DO NOTHING; the condition CHECK is dropped and re-added under the same name.
--
-- Applied to production (supabase-9cd8-db) on 2026-10-14.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- =========================================================================
-- ROLE GUARD (prod-parity audit, 2026-08-19). Runs FIRST, inside the transaction. See 0002/0004/
-- 0006–0012: production's `public` relations are owned by `supabase_admin`, and `postgres` there
-- is neither superuser nor a member of that role. Run as `postgres`, REVOKE reports success and
-- revokes nothing; this guard turns that into an error.
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
-- Shared optimistic-concurrency bump. Ignores whatever the writer put in NEW.row_version, so a
-- client can never skip or rewind a version.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.bump_row_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $bump_row_version$
BEGIN
  NEW.row_version := OLD.row_version + 1;
  RETURN NEW;
END
$bump_row_version$;

REVOKE ALL ON FUNCTION public.bump_row_version() FROM PUBLIC, anon, authenticated;

-- =========================================================================
-- warehouse_locations
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.warehouse_locations (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    code          text        NOT NULL UNIQUE CHECK (code ~ '^[NESWC]-[A-Z0-9]+(-[A-Z0-9]+)*$'),
    name          text        NOT NULL CHECK (length(btrim(name)) > 0),
    kind          text        NOT NULL CHECK (kind IN ('shelf', 'level', 'box', 'floor', 'rug')),
    parent_id     uuid        REFERENCES public.warehouse_locations(id) ON DELETE RESTRICT,
    wall          text        CHECK (wall IN ('N', 'E', 'S', 'W', 'C')),
    pos_x         numeric(5,2) CHECK (pos_x BETWEEN 0 AND 5),
    pos_y         numeric(5,2) CHECK (pos_y BETWEEN 0 AND 5),
    width         numeric(5,2) CHECK (width > 0),
    depth         numeric(5,2) CHECK (depth > 0),
    height        numeric(5,2) CHECK (height > 0),
    level_index   integer     CHECK (level_index >= 0),
    rotation_deg  integer     NOT NULL DEFAULT 0 CHECK (rotation_deg IN (0, 90, 180, 270)),
    is_active     boolean     NOT NULL DEFAULT true,
    row_version   integer     NOT NULL DEFAULT 1,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    updated_by    uuid        REFERENCES public.admin_users(user_id) ON DELETE SET NULL,
    CONSTRAINT warehouse_locations_not_own_parent CHECK (parent_id IS NULL OR parent_id <> id),
    CONSTRAINT warehouse_locations_level_has_parent CHECK (kind <> 'level' OR parent_id IS NOT NULL),
    CONSTRAINT warehouse_locations_root_kinds CHECK (kind NOT IN ('shelf', 'floor', 'rug') OR parent_id IS NULL)
);

COMMENT ON TABLE public.warehouse_locations IS
    'Ubicaciones de la bodega (sala 5x5 m): estantes por muro, niveles, cajas, zonas de piso y la '
    'alfombra central. Coordenadas en metros desde la esquina superior izquierda. 0021.';

CREATE INDEX IF NOT EXISTS warehouse_locations_parent_id_idx
    ON public.warehouse_locations (parent_id) WHERE parent_id IS NOT NULL;

-- A CHECK cannot read another row, so the parent's kind is validated here. Allowed shapes:
-- level -> shelf; box -> shelf | level | floor | rug (or no parent: loose on the floor);
-- shelf/floor/rug are roots (table CHECK). Boxes never contain boxes, so no cycle can form.
CREATE OR REPLACE FUNCTION public.warehouse_locations_validate_parent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $warehouse_locations_validate_parent$
DECLARE
  parent_kind text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.kind <> OLD.kind
     AND EXISTS (SELECT 1 FROM public.warehouse_locations WHERE parent_id = NEW.id) THEN
    RAISE EXCEPTION 'No se puede cambiar el tipo de una ubicacion que contiene otras ubicaciones';
  END IF;

  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT kind INTO parent_kind FROM public.warehouse_locations WHERE id = NEW.parent_id;
  IF NOT FOUND THEN
    RETURN NEW; -- the FK rejects it with its own error
  END IF;

  IF NEW.kind = 'level' AND parent_kind <> 'shelf' THEN
    RAISE EXCEPTION 'Un nivel debe pertenecer a un estante';
  END IF;

  IF NEW.kind = 'box' AND parent_kind NOT IN ('shelf', 'level', 'floor', 'rug') THEN
    RAISE EXCEPTION 'Una caja va en un estante, un nivel, el piso o la alfombra';
  END IF;

  RETURN NEW;
END
$warehouse_locations_validate_parent$;

REVOKE ALL ON FUNCTION public.warehouse_locations_validate_parent() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS warehouse_locations_validate_parent ON public.warehouse_locations;
CREATE TRIGGER warehouse_locations_validate_parent
    BEFORE INSERT OR UPDATE ON public.warehouse_locations
    FOR EACH ROW EXECUTE FUNCTION public.warehouse_locations_validate_parent();

DROP TRIGGER IF EXISTS warehouse_locations_bump_row_version ON public.warehouse_locations;
CREATE TRIGGER warehouse_locations_bump_row_version
    BEFORE UPDATE ON public.warehouse_locations
    FOR EACH ROW EXECUTE FUNCTION public.bump_row_version();

DROP TRIGGER IF EXISTS warehouse_locations_set_updated_at ON public.warehouse_locations;
CREATE TRIGGER warehouse_locations_set_updated_at
    BEFORE UPDATE ON public.warehouse_locations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

REVOKE ALL ON TABLE public.warehouse_locations FROM PUBLIC;
REVOKE ALL ON TABLE public.warehouse_locations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.warehouse_locations TO service_role;

ALTER TABLE public.warehouse_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service_role full access to warehouse_locations" ON public.warehouse_locations;
CREATE POLICY "Allow service_role full access to warehouse_locations"
    ON public.warehouse_locations
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- The only seeded location: the "magic carpet" in the middle of the room.
INSERT INTO public.warehouse_locations (code, name, kind, wall, pos_x, pos_y, width, depth)
VALUES ('C-ALF', 'Alfombra central', 'rug', 'C', 2.5, 2.5, 1.6, 1.2)
ON CONFLICT (code) DO NOTHING;

-- =========================================================================
-- serialised_assets: wear, row_version, location_id
-- =========================================================================
ALTER TABLE public.serialised_assets
    ADD COLUMN IF NOT EXISTS wear text NOT NULL DEFAULT 'used'
        CONSTRAINT serialised_assets_wear_check CHECK (wear IN ('new', 'used')),
    ADD COLUMN IF NOT EXISTS row_version integer NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS location_id uuid
        REFERENCES public.warehouse_locations(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.serialised_assets.wear IS
    'Condicion comercial de la unidad: new (Nuevo) o used (Usado). 0021.';
COMMENT ON COLUMN public.serialised_assets.location_id IS
    'Ubicacion estructurada. Si esta presente, la columna location (texto) se deriva de ella. 0021.';
COMMENT ON COLUMN public.serialised_assets.row_version IS
    'Version para concurrencia optimista; la sube un trigger en cada UPDATE. 0021.';

CREATE INDEX IF NOT EXISTS serialised_assets_location_id_idx
    ON public.serialised_assets (location_id) WHERE location_id IS NOT NULL;

-- Condition vocabulary gains 'blocked'. Assert the inline CHECK from 0004 exists under its
-- default name first: DROP ... IF EXISTS on a renamed constraint would silently leave the old
-- five-value vocabulary enforced (same reasoning as 0003 step 3).
DO $assert_condition_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'serialised_assets'
      AND constraint_name = 'serialised_assets_condition_check'
      AND constraint_type = 'CHECK'
  ) THEN
    RAISE EXCEPTION
      'Abortado: no existe la restriccion serialised_assets_condition_check en '
      'public.serialised_assets. Fue renombrada; reemplazarla a ciegas dejaria el vocabulario '
      'antiguo vigente.';
  END IF;
END
$assert_condition_constraint$;

ALTER TABLE public.serialised_assets DROP CONSTRAINT serialised_assets_condition_check;
ALTER TABLE public.serialised_assets ADD CONSTRAINT serialised_assets_condition_check CHECK (condition IN ('operational', 'maintenance', 'cleaning', 'damaged', 'blocked', 'retired'));

DROP TRIGGER IF EXISTS serialised_assets_bump_row_version ON public.serialised_assets;
CREATE TRIGGER serialised_assets_bump_row_version
    BEFORE UPDATE ON public.serialised_assets
    FOR EACH ROW EXECUTE FUNCTION public.bump_row_version();

-- Derive the legacy text from location_id. Units placed in a location deactivated later keep
-- working (other columns can still be updated); only moving a unit INTO an inactive location, or
-- creating one there, is refused.
CREATE OR REPLACE FUNCTION public.serialised_assets_sync_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $serialised_assets_sync_location$
DECLARE
  loc_code text;
  loc_name text;
  loc_active boolean;
BEGIN
  IF NEW.location_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT code, name, is_active INTO loc_code, loc_name, loc_active
  FROM public.warehouse_locations
  WHERE id = NEW.location_id;

  IF NOT FOUND THEN
    RETURN NEW; -- the FK rejects it with its own error
  END IF;

  IF NOT loc_active THEN
    IF TG_OP = 'INSERT' OR NEW.location_id IS DISTINCT FROM OLD.location_id THEN
      RAISE EXCEPTION 'La ubicacion % esta desactivada', loc_code;
    END IF;
  END IF;

  NEW.location := loc_code || ' · ' || loc_name;
  RETURN NEW;
END
$serialised_assets_sync_location$;

REVOKE ALL ON FUNCTION public.serialised_assets_sync_location() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS serialised_assets_sync_location ON public.serialised_assets;
CREATE TRIGGER serialised_assets_sync_location
    BEFORE INSERT OR UPDATE ON public.serialised_assets
    FOR EACH ROW EXECUTE FUNCTION public.serialised_assets_sync_location();

-- Renaming a location rewrites the derived text of the units stored there (the sync trigger
-- recomputes it; the no-op SET is what fires it).
CREATE OR REPLACE FUNCTION public.warehouse_locations_propagate_label()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $warehouse_locations_propagate_label$
BEGIN
  UPDATE public.serialised_assets
     SET location_id = location_id
   WHERE location_id = NEW.id;
  RETURN NEW;
END
$warehouse_locations_propagate_label$;

REVOKE ALL ON FUNCTION public.warehouse_locations_propagate_label() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS warehouse_locations_propagate_label ON public.warehouse_locations;
CREATE TRIGGER warehouse_locations_propagate_label
    AFTER UPDATE OF code, name ON public.warehouse_locations
    FOR EACH ROW
    WHEN (OLD.code IS DISTINCT FROM NEW.code OR OLD.name IS DISTINCT FROM NEW.name)
    EXECUTE FUNCTION public.warehouse_locations_propagate_label();

-- =========================================================================
-- asset_relocations — append-only; inserting a row performs the move.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.asset_relocations (
    id                 bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    asset_id           bigint      NOT NULL REFERENCES public.serialised_assets(id) ON DELETE RESTRICT,
    from_location_id   uuid        REFERENCES public.warehouse_locations(id) ON DELETE RESTRICT,
    to_location_id     uuid        NOT NULL REFERENCES public.warehouse_locations(id) ON DELETE RESTRICT,
    moved_by_admin_id  uuid        REFERENCES public.admin_users(user_id) ON DELETE SET NULL,
    moved_at           timestamptz NOT NULL DEFAULT now(),
    source             text        NOT NULL CHECK (source IN ('dashboard', 'ops')),
    notes              text,
    CONSTRAINT asset_relocations_moves CHECK (from_location_id IS DISTINCT FROM to_location_id)
);

COMMENT ON TABLE public.asset_relocations IS
    'Historial de traslados de unidades entre ubicaciones. Insertar una fila ejecuta el traslado '
    '(trigger); PT409 si la unidad ya no estaba en from_location_id. 0021.';

CREATE INDEX IF NOT EXISTS asset_relocations_asset_id_moved_at_idx
    ON public.asset_relocations (asset_id, moved_at DESC);

CREATE OR REPLACE FUNCTION public.asset_relocations_apply()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $asset_relocations_apply$
DECLARE
  moved integer;
BEGIN
  UPDATE public.serialised_assets
     SET location_id = NEW.to_location_id
   WHERE id = NEW.asset_id
     AND location_id IS NOT DISTINCT FROM NEW.from_location_id;

  GET DIAGNOSTICS moved = ROW_COUNT;

  IF moved = 0 THEN
    RAISE EXCEPTION 'La unidad ya no esta en la ubicacion de origen; recarga y vuelve a intentar'
      USING ERRCODE = 'PT409';
  END IF;

  RETURN NEW;
END
$asset_relocations_apply$;

REVOKE ALL ON FUNCTION public.asset_relocations_apply() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS asset_relocations_apply ON public.asset_relocations;
CREATE TRIGGER asset_relocations_apply
    AFTER INSERT ON public.asset_relocations
    FOR EACH ROW EXECUTE FUNCTION public.asset_relocations_apply();

REVOKE ALL ON TABLE public.asset_relocations FROM PUBLIC;
REVOKE ALL ON TABLE public.asset_relocations FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.asset_relocations TO service_role;

ALTER TABLE public.asset_relocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service_role full access to asset_relocations" ON public.asset_relocations;
CREATE POLICY "Allow service_role full access to asset_relocations"
    ON public.asset_relocations
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =========================================================================
-- asset_movements.incident_type — check-in canon vocabulary. Nullable: most movements have none.
-- =========================================================================
ALTER TABLE public.asset_movements
    ADD COLUMN IF NOT EXISTS incident_type text
        CONSTRAINT asset_movements_incident_type_check
        CHECK (incident_type IS NULL OR incident_type IN ('physical_damage', 'missing_part', 'moisture', 'electrical_failure', 'cosmetic_wear', 'not_returned', 'other'));

-- =========================================================================
-- product_unit_counts
-- =========================================================================
CREATE OR REPLACE VIEW public.product_unit_counts
    WITH (security_invoker = true)
    AS
    SELECT
        p.id AS product_id,
        count(a.id) FILTER (WHERE a.condition <> 'retired')::integer AS total,
        count(a.id) FILTER (WHERE a.condition = 'operational' AND s.direction IS DISTINCT FROM 'checkout')::integer AS available,
        count(a.id) FILTER (WHERE a.condition <> 'retired' AND s.direction = 'checkout')::integer AS in_rental,
        count(a.id) FILTER (WHERE a.condition IN ('maintenance', 'cleaning') AND s.direction IS DISTINCT FROM 'checkout')::integer AS maintenance,
        count(a.id) FILTER (WHERE a.condition = 'damaged' AND s.direction IS DISTINCT FROM 'checkout')::integer AS damaged,
        count(a.id) FILTER (WHERE a.condition = 'blocked' AND s.direction IS DISTINCT FROM 'checkout')::integer AS blocked,
        count(a.id) FILTER (WHERE a.condition = 'retired')::integer AS retired
    FROM public.products p
    LEFT JOIN public.serialised_assets a ON a.product_id = p.id
    LEFT JOIN public.asset_current_state s ON s.asset_id = a.id
    GROUP BY p.id;

COMMENT ON VIEW public.product_unit_counts IS
    'Conteo de unidades por producto. total excluye archivadas y es la suma de available, '
    'in_rental, maintenance (incluye limpieza), damaged y blocked. in_rental se deriva del ultimo '
    'movimiento (asset_current_state), nunca se guarda. 0021.';

REVOKE ALL ON TABLE public.product_unit_counts FROM PUBLIC;
REVOKE ALL ON TABLE public.product_unit_counts FROM anon, authenticated;
GRANT SELECT ON TABLE public.product_unit_counts TO service_role;

-- =========================================================================
-- End-state assertion, inside the transaction: any miss rolls the whole migration back.
-- =========================================================================
DO $assert_0021$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_locations WHERE code = 'C-ALF' AND kind = 'rug') THEN
    RAISE EXCEPTION 'Abortado: falta la alfombra central C-ALF';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'serialised_assets_condition_check'
      AND conrelid = 'public.serialised_assets'::regclass
      AND pg_get_constraintdef(oid) LIKE '%blocked%'
  ) THEN
    RAISE EXCEPTION 'Abortado: la restriccion de condicion no admite blocked';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid IN ('public.warehouse_locations'::regclass, 'public.asset_relocations'::regclass)
      AND NOT relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Abortado: RLS no quedo habilitado en las tablas nuevas';
  END IF;

  IF has_table_privilege('anon', 'public.warehouse_locations', 'SELECT')
     OR has_table_privilege('anon', 'public.asset_relocations', 'SELECT')
     OR has_table_privilege('anon', 'public.product_unit_counts', 'SELECT') THEN
    RAISE EXCEPTION 'Abortado: anon conserva lectura sobre objetos de 0021';
  END IF;
END
$assert_0021$;

COMMIT;

-- =========================================================================
-- Post-apply checks.
--
--   SELECT code, name, kind FROM public.warehouse_locations;            -- exactly C-ALF
--   SELECT count(*) FILTER (WHERE wear = 'used') = count(*) FROM public.serialised_assets;
--   SELECT sum(total) = sum(available + in_rental + maintenance + damaged + blocked)
--     FROM public.product_unit_counts;                                  -- true
--
--   SELECT has_table_privilege('hermes_ro', 'public.warehouse_locations', 'SELECT'),  -- false
--          has_table_privilege('hermes_ro', 'public.asset_relocations', 'SELECT'),    -- false
--          has_table_privilege('hermes_ro', 'public.product_unit_counts', 'SELECT');  -- false
--
-- PostgREST caches the schema; reload it so the new objects are reachable:
--
--   NOTIFY pgrst, 'reload schema';
-- =========================================================================
