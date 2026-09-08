--
-- 0009_asset_tags.sql — internal asset tag on `serialised_assets` (serialised inventory, label
-- roll for the physical count).
--
-- SDD artifacts (design.md, specs/*, audits/, rehearsals/) live at the mhans workspace root:
-- ../../../openspec/changes/consolidado-web-2027/ (OUTSIDE this repo — not visible from a clone
-- of `dashboard/` alone; see R2-003).
--
-- WHY A SECOND IDENTIFIER. `serial_number` is the manufacturer's and it is the identity the
-- count records — but it cannot be printed ahead of time, it is not on every unit (cables,
-- stands, adapters), and it is not machine-readable on the ones that do carry it. The client's
-- decision: every physical unit gets an internal tag `MH-00001`, pre-printed on a label roll
-- BEFORE the count. During the count the operator sticks a label, scans or types the tag, then
-- enters the serial. The label's QR code and Code 128 barcode both encode the tag, never the
-- serial, so a phone camera and a keyboard-wedge gun resolve to the same row.
--
-- WHY A COLUMN AND NOT THE PRIMARY KEY. `id` is an identity column that other tables already
-- reference (`asset_movements`, 0006). The tag is a business identifier with a printable format;
-- tying it to the surrogate key would make a reprinted roll or a skipped label a schema problem.
-- The backfill below DOES seed existing rows from `id` — it is the only monotonic sequence those
-- rows have, and it keeps the tags of units entered before the roll existed in the same number
-- space as the roll — but nothing after the backfill couples the two.
--
-- FORMAT. `^MH-[0-9]{5}$`, upper case, enforced by CHECK. The application normalises what the
-- scanner or the operator produces (`src/lib/assetTag.ts`); the constraint refuses anything that
-- slipped past it. 99,999 tags is two orders of magnitude above the catalogue.
--
-- UNIQUE, and never reused. A UNIQUE index rather than a table constraint so it can carry a
-- name the application's 23505 handler can match; `serialised_assets` also carries the unique
-- index on `lower(btrim(serial_number))` from 0004, and the service must tell the two apart to
-- phrase the error ("tag already assigned" vs "serial already registered").
--
-- ORDER OF OPERATIONS. Add nullable → backfill → SET NOT NULL → CHECK → UNIQUE. Each step is
-- guarded so a partial apply replays cleanly: `ADD COLUMN IF NOT EXISTS`, a backfill scoped to
-- `WHERE asset_tag IS NULL`, `pg_constraint`/`pg_indexes` lookups for the constraints (Postgres
-- has no `ADD CONSTRAINT IF NOT EXISTS`). SET NOT NULL is idempotent by itself.
--
-- NO PRIVILEGE STATEMENT. Widening a table does not widen any grantee's surface: `anon` and
-- `authenticated` were revoked by 0004 and `hermes_ro` never held anything on this table — the
-- Telegram agent has no call site for tags, serials or shelf locations (inventory-security
-- data). Same posture as 0004/0006/0007/0008: do not add a grant here without an ADR-D8 allowlist
-- change and a matching update to `hermes-mhans/scripts/assert-least-privilege.sh`, which asserts
-- the allowlist is EXACT.
--
-- LOCKING. `ADD COLUMN` (nullable, no default) and `SET NOT NULL` each take ACCESS EXCLUSIVE;
-- SET NOT NULL scans the table to prove it, which at this table's size (the count is in
-- progress, hundreds of rows at most) is milliseconds. `lock_timeout` makes a contended apply
-- fail fast; re-run it.
--
-- Idempotent: see ORDER OF OPERATIONS.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- =========================================================================
-- ROLE GUARD (prod-parity audit, 2026-08-19). Runs FIRST, inside the transaction. See 0002/0004/
-- 0006/0007/0008 for the full rationale: production's `public` relations are owned by
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
-- The column, nullable for now so the backfill can run before the constraint lands.
-- =========================================================================
ALTER TABLE public.serialised_assets
    ADD COLUMN IF NOT EXISTS asset_tag text;

-- =========================================================================
-- Backfill units entered before the roll existed. `id` is their only monotonic sequence and is
-- already unique, so the derived tags are unique too and sit in the same number space the roll
-- continues from (`nextAssetTag` reads the highest tag, not the highest id). Scoped to NULL so a
-- replay never overwrites a tag that was assigned from a real label.
-- =========================================================================
UPDATE public.serialised_assets
   SET asset_tag = 'MH-' || lpad(id::text, 5, '0')
 WHERE asset_tag IS NULL;

ALTER TABLE public.serialised_assets
    ALTER COLUMN asset_tag SET NOT NULL;

-- =========================================================================
-- The format. Upper case only: the application upper-cases before writing, and a constraint that
-- accepted `mh-00001` would let two spellings of one label coexist under the UNIQUE index.
-- =========================================================================
DO $add_format_check$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'serialised_assets_asset_tag_format_check'
          AND conrelid = 'public.serialised_assets'::regclass
    ) THEN
        ALTER TABLE public.serialised_assets
            ADD CONSTRAINT serialised_assets_asset_tag_format_check
            CHECK (asset_tag ~ '^MH-[0-9]{5}$');
    END IF;
END
$add_format_check$;

-- =========================================================================
-- Never reused. Named so the service can distinguish this 23505 from the serial-number one.
-- =========================================================================
CREATE UNIQUE INDEX IF NOT EXISTS serialised_assets_asset_tag_key
    ON public.serialised_assets (asset_tag);

COMMENT ON COLUMN public.serialised_assets.asset_tag IS
    'Etiqueta interna MH-00000 impresa en el rollo antes del conteo. Es lo que codifican el QR y '
    'el codigo de barras de la etiqueta; nunca se reutiliza.';

COMMIT;

-- =========================================================================
-- Post-apply assertions.
--
-- Every row carries a well-formed, unique tag, and the two indexes coexist:
--
--   SELECT count(*) FILTER (WHERE asset_tag !~ '^MH-[0-9]{5}$') AS malformed,
--          count(*) - count(DISTINCT asset_tag)                  AS duplicates
--     FROM public.serialised_assets;
--   -- expect: 0 | 0
--
--   SELECT indexname FROM pg_indexes
--    WHERE tablename = 'serialised_assets' AND indexname = 'serialised_assets_asset_tag_key';
--
-- Privilege posture unchanged (both must read `false`, as after 0004):
--
--   SELECT has_table_privilege('hermes_ro', 'public.serialised_assets', 'SELECT') AS ro_select,
--          has_table_privilege('anon',      'public.serialised_assets', 'SELECT') AS anon_select;
--
-- PostgREST caches the schema; reload it so the new column is writable through the API:
--
--   NOTIFY pgrst, 'reload schema';
-- =========================================================================
