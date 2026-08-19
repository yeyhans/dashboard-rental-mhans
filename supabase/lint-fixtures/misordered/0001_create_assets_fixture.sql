--
-- FIXTURE — NOT A MIGRATION. NEVER APPLY THIS FILE.
--
-- Lives outside supabase/migrations/ on purpose so no migration runner can pick it up. Its only
-- job is to give ../../migrations/lint-chain.sh something to fail on, proving the lint actually
-- detects the ADR-D8 ordering violation instead of vacuously passing on a clean directory.
--
-- The violation it encodes: a new table created at sequence 0001, i.e. BEFORE
-- 0002_hermes_least_privilege.sql revokes `ALTER DEFAULT PRIVILEGES ... GRANT SELECT ON TABLES
-- TO hermes_ro`. On a real chain this table would silently become agent-readable at creation
-- time, with no reviewed grant line anywhere.
--
-- Expected lint result:
--   $ ./lint-chain.sh ../lint-fixtures/misordered   ->  1 finding, exit 1
--

CREATE TABLE public.assets_fixture (
    id           bigserial PRIMARY KEY,
    product_id   integer NOT NULL,
    serial       text NOT NULL,
    condition    text,
    location     text,
    created_at   timestamptz NOT NULL DEFAULT now()
);
