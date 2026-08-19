--
-- 0004_serialised_assets.sql — serialised asset records for the M6 intake UI (T-034,
-- serialised-inventory-operations/spec.md)
--
-- SDD artifacts (design.md, specs/*, audits/, rehearsals/) live at the mhans workspace root:
-- ../../../openspec/changes/consolidado-web-2027/ (OUTSIDE this repo — not visible from a clone
-- of `dashboard/` alone; see R2-003).
--
-- WHY A NEW TABLE. `products` is one row per catalogue model — it carries `price`, `sku`,
-- `stock_status`, SEO copy. It cannot carry a serial: the rental owns several physical Profoto
-- B10 units behind a single `products` row, each with its own serial, condition and shelf.
-- `orders.line_items` (jsonb) is authoritative for what an order contains, but it is order-scoped
-- and describes models, not units; there is no `order_items` table to extend. Nothing in the 14
-- baseline relations records a physical unit, so a new table is the only option. It is
-- deliberately narrow: identity (serial), state (condition), place (location) and optional kit
-- membership. Availability enforcement (`daterange` / `EXCLUDE USING gist`) is a separate,
-- dependent capability and is NOT modelled here — per the spec, intake must ship without it.
--
-- WHY 0004 AND NOT 0003. 0003 is reserved for the M4 order-status migration, which is not yet
-- written. Numbering this 0004 leaves that slot free; the only ordering rule the chain enforces
-- is `lint-chain.sh`'s (a CREATE TABLE must sort at or above 0002), which 0004 satisfies.
--
-- ORDERING CONSTRAINT — this is the migration 0002 was written for. Before 0002, two
-- `pg_default_acl` entries granted SELECT on every future table in `public` to `hermes_ro`, so
-- this table would have become agent-readable at creation time with no line here to review.
-- After 0002 it is created with no privileges for `hermes_ro` at all, and this migration adds
-- none. Serial numbers and equipment locations are inventory-security data; the Telegram agent
-- has no call site for them. Runtime proof:
-- `hermes-mhans/scripts/assert-serialised-assets-isolation.sh`.
--
-- CONDITION VOCABULARY. English tokens (code), Spanish labels (UI), per the project convention.
-- Derived from the equipment states in `.claude/rules/01-business-context.md`. `operational`
-- covers "disponible" and "arrendado" alike: this table records the state of the unit, not its
-- booking — that belongs to the availability capability.
--
-- Idempotent: IF NOT EXISTS throughout, so a partial apply can be replayed.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

CREATE TABLE IF NOT EXISTS public.serialised_assets (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id    integer     NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    serial_number text        NOT NULL CHECK (length(btrim(serial_number)) > 0),
    condition     text        NOT NULL CHECK (condition IN ('operational', 'maintenance', 'cleaning', 'damaged', 'retired')),
    location      text        NOT NULL CHECK (length(btrim(location)) > 0),
    kit_code      text        CHECK (kit_code IS NULL OR length(btrim(kit_code)) > 0),
    notes         text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ON DELETE RESTRICT, not CASCADE: deleting a catalogue row must not silently erase the physical
-- units counted against it. The delete should fail and force a decision.

COMMENT ON TABLE public.serialised_assets IS
    'One physical unit of a products row: serial, condition, location, optional kit. M6 intake (T-034).';

-- Retrieval by serial number is the spec's stated read path ("retrievable by serial number").
-- Lowercased so a serial typed as profoto-b10-0007 finds PROFOTO-B10-0007 and, more importantly,
-- so the two cannot both be entered as separate units during the count.
CREATE UNIQUE INDEX IF NOT EXISTS serialised_assets_serial_number_lower_key
    ON public.serialised_assets (lower(btrim(serial_number)));

CREATE INDEX IF NOT EXISTS serialised_assets_product_id_idx
    ON public.serialised_assets (product_id);

-- Partial: kit membership is optional and most units are loose, so the index stays small.
CREATE INDEX IF NOT EXISTS serialised_assets_kit_code_idx
    ON public.serialised_assets (kit_code) WHERE kit_code IS NOT NULL;

-- CREATE TRIGGER has no IF NOT EXISTS in PG 15, so the drop keeps the migration replayable.
DROP TRIGGER IF EXISTS serialised_assets_set_updated_at ON public.serialised_assets;
CREATE TRIGGER serialised_assets_set_updated_at
    BEFORE UPDATE ON public.serialised_assets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- Privileges. Supabase's default grants hand `anon` and `authenticated` a working surface on new
-- tables in `public`; the anon write exposure closed by 0001 started exactly that way. This table
-- is admin-only and reached solely through the dashboard's service-role client, so every other
-- grantee is revoked explicitly rather than left to whatever the default privileges happen to be
-- at apply time.
--
-- `hermes_ro` is absent by construction (0002 revoked the default privilege) and is deliberately
-- not granted here. Do not add a grant without an ADR-D8 allowlist change and a matching update
-- to `hermes-mhans/scripts/assert-least-privilege.sh`, which asserts the allowlist is EXACT and
-- will fail the build on an unreviewed addition.
-- =========================================================================
REVOKE ALL ON TABLE public.serialised_assets FROM PUBLIC;
REVOKE ALL ON TABLE public.serialised_assets FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.serialised_assets TO service_role;

ALTER TABLE public.serialised_assets ENABLE ROW LEVEL SECURITY;

-- Grant and policy must both exist or the read is a silent zero-row result (the F-3 failure mode
-- from the 0002 audit). service_role bypasses RLS, but the policy is written anyway so the table
-- is not left policy-less if RLS bypass is ever narrowed.
DROP POLICY IF EXISTS "Allow service_role full access to serialised_assets" ON public.serialised_assets;
CREATE POLICY "Allow service_role full access to serialised_assets"
    ON public.serialised_assets
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMIT;

-- =========================================================================
-- Post-apply assertion (T-034 acceptance). Both rows must read `false`; a `true` means the
-- default privilege survived 0002 for some grantor, or a later change granted access without
-- review. This is the core of `hermes-mhans/scripts/assert-serialised-assets-isolation.sh`.
--
--   SELECT has_table_privilege('hermes_ro', 'public.serialised_assets', 'SELECT') AS ro_select,
--          has_table_privilege('anon',      'public.serialised_assets', 'SELECT') AS anon_select;
-- =========================================================================
