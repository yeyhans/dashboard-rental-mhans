--
-- 0009_asset_tags.down.sql
--
-- SDD artifacts live at ../../../openspec/changes/consolidado-web-2027/ (outside this repo,
-- see R2-003).
--
-- Rollback for 0009_asset_tags.sql (ADR-D5 `.down.sql` convention).
--
-- DATA LOSS. Dropping the column discards the link between every physical unit and the label
-- stuck on it. Rows backfilled from `id` are re-derivable — re-applying the forward migration
-- regenerates `MH-<id>` — but a tag assigned from a REAL label during the count is not: the
-- forward backfill would give that unit `MH-<id>`, which is not the sticker on the equipment,
-- and every label scanned afterwards would miss. Capture what would be lost before running it:
--
--   SELECT id, asset_tag, serial_number
--     FROM public.serialised_assets
--    WHERE asset_tag <> 'MH-' || lpad(id::text, 5, '0')
--    ORDER BY id;
--
-- If that returns rows, this rollback is destructive in a way re-applying cannot undo.
--
-- It also re-breaks the write path: the intake form and `POST /api/inventory/assets` require the
-- tag and the service inserts it, so every registration returns to failing with `42703` until the
-- forward migration is re-applied. Roll back only to unblock an apply, and re-apply forward.
--
-- The CHECK constraint, the UNIQUE index and the COMMENT are dropped together with the column
-- they hang off — no separate statements needed. Privileges are untouched in both directions;
-- `hermes_ro` never held any on this table.
--
-- Idempotent: IF EXISTS, so a re-run is safe.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- =========================================================================
-- ROLE GUARD. Same reasoning as the forward migration: `ALTER TABLE ... DROP COLUMN` requires
-- ownership, and in production `public` relations are owned by `supabase_admin`, not `postgres`.
--
-- Apply with:  psql -U supabase_admin -v ON_ERROR_STOP=1 -f <this file>
-- =========================================================================
DO $role_guard$
BEGIN
  IF NOT pg_has_role(current_user, 'supabase_admin', 'USAGE') THEN
    RAISE EXCEPTION
      'Este rollback debe ejecutarse como supabase_admin (rol actual: %). Las relaciones de public '
      'pertenecen a supabase_admin: ALTER TABLE ... DROP COLUMN exige ser dueno de la tabla.',
      current_user
      USING HINT = 'psql -U supabase_admin -v ON_ERROR_STOP=1 -f <archivo>';
  END IF;
END
$role_guard$;

ALTER TABLE public.serialised_assets
    DROP COLUMN IF EXISTS asset_tag;

COMMIT;

-- =========================================================================
-- Post-rollback: PostgREST caches the schema, so the dropped column lingers in its map until the
-- cache is refreshed. Reload it so the rolled-back state is the observed state.
--
--   NOTIFY pgrst, 'reload schema';
-- =========================================================================
