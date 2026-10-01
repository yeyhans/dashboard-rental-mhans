--
-- 0012_asset_current_state.sql — one row per unit: its latest movement.
--
-- SDD artifacts (design.md, specs/*, audits/, rehearsals/) live at the mhans workspace root:
-- ../../../openspec/changes/consolidado-web-2027/ (OUTSIDE this repo — not visible from a clone
-- of `dashboard/` alone; see R2-003).
--
-- WHY. "Is this unit out right now?" is answered by its LATEST movement (0006: a checkout with no
-- later checkin). Until this migration the application derived that from a window of the most
-- recent N `asset_movements` rows (`STATE_WINDOW` / `MOVEMENT_WINDOW`, N = 5000), which has a
-- silent failure mode: once a unit's checkout ages past the window because other units kept
-- moving, the unit is reported as available while it is still out on a client's order (review
-- R3-101). No number fixes that — the database has to answer the question.
--
-- WHAT. A plain view (not materialised: `asset_movements` is small and the partial index
-- `asset_movements_open_checkout_idx` from 0006 keeps the scan narrow). `DISTINCT ON (asset_id)`
-- ordered by `checked_at DESC, id DESC` picks one row per unit. The `id DESC` tie-break matters:
-- two movements recorded in the same instant (a checkin and a re-checkout from a fast scanner, or
-- a backfill) must resolve deterministically to the one inserted last, not to whichever row the
-- planner happened to read first.
--
-- PRIVILEGES. Created by `supabase_admin` in `public`, so `pg_default_acl` (0005 revoked the
-- `anon`/`authenticated` defaults, but belt-and-braces per the 0004/0006 convention) is followed
-- by explicit REVOKEs: nothing for PUBLIC, nothing for `anon`/`authenticated`, SELECT for
-- `service_role` only — the dashboard reads it through `supabaseAdmin`. `hermes_ro` gains NOTHING:
-- it holds no privilege on `asset_movements` (0006) and a view over that table must not become a
-- side door. Per the 0004–0011 convention: do not add a privilege statement here without an
-- ADR-D8 allowlist change and a matching update to `hermes-mhans/scripts/assert-least-privilege.sh`.
--
-- `security_invoker = true`: the view runs with the caller's privileges, so it can never be used
-- to read `asset_movements` by a role that cannot read the table itself.
--
-- Idempotent: `CREATE OR REPLACE VIEW`; REVOKE/GRANT are no-ops when already applied.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- =========================================================================
-- ROLE GUARD (prod-parity audit, 2026-08-19). Runs FIRST, inside the transaction. See 0002/0004/
-- 0006–0011 for the full rationale: production's `public` relations are owned by
-- `supabase_admin`, and `postgres` there is neither superuser nor a member of that role. Run as
-- `postgres`, REVOKE reports success and revokes nothing; this guard turns that into an error.
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

CREATE OR REPLACE VIEW public.asset_current_state
    WITH (security_invoker = true)
    AS
    SELECT DISTINCT ON (asset_id)
        asset_id,
        order_id,
        direction,
        checked_at,
        checked_by_admin_id
    FROM public.asset_movements
    ORDER BY asset_id, checked_at DESC, id DESC;

COMMENT ON VIEW public.asset_current_state IS
    'Ultimo movimiento por unidad (DISTINCT ON asset_id, checked_at DESC, id DESC). direction = '
    'checkout significa que la unidad esta afuera en order_id. Reemplaza la ventana de N filas que '
    'usaba la aplicacion (R3-101).';

REVOKE ALL ON TABLE public.asset_current_state FROM PUBLIC;
REVOKE ALL ON TABLE public.asset_current_state FROM anon, authenticated;
GRANT SELECT ON TABLE public.asset_current_state TO service_role;

COMMIT;

-- =========================================================================
-- Post-apply assertions.
--
--   -- One row per unit, and only units that have ever moved:
--   SELECT count(*) = count(DISTINCT asset_id) AS one_per_asset FROM public.asset_current_state;
--
--   -- Units out right now:
--   SELECT asset_id, order_id, checked_at
--     FROM public.asset_current_state WHERE direction = 'checkout' ORDER BY checked_at;
--
-- Privilege posture (must match the ADR-D8 allowlist):
--
--   SELECT has_table_privilege('hermes_ro', 'public.asset_current_state', 'SELECT') AS ro_select, -- false
--          has_table_privilege('anon', 'public.asset_current_state', 'SELECT')      AS anon_select, -- false
--          has_table_privilege('service_role', 'public.asset_current_state', 'SELECT') AS sr_select; -- true
--
-- PostgREST caches the schema; reload it so the view is readable through the API:
--
--   NOTIFY pgrst, 'reload schema';
-- =========================================================================
