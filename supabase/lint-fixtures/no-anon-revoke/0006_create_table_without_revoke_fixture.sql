--
-- FIXTURE — NOT A MIGRATION. NEVER APPLY THIS FILE.
--
-- Lives outside supabase/migrations/ on purpose so no migration runner can pick it up. Its only
-- job is to give ../../migrations/lint-chain.sh something to fail on, proving RULE 2 (the anon
-- REVOKE rule) actually detects the violation instead of vacuously passing on a clean directory.
--
-- The violation it encodes: a table created in `public` with NO `REVOKE ... FROM anon`. On a real
-- chain, `pg_default_acl` hands `anon` and `authenticated` the full table privilege set
-- (`arwdDxt` — INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER) at creation time,
-- from both the `postgres` and `supabase_admin` grantors. So this table would be born writable and
-- TRUNCATE-able by anyone holding the public anon key, silently, with no line to review. Compare
-- `0004_serialised_assets.sql:93-94`, which does it correctly.
--
-- Sequence 0006 is deliberate: it sorts ABOVE 0002, so rule 1 (ordering) does not fire and the
-- single finding this fixture produces is unambiguously rule 2. A fixture that tripped both rules
-- would not prove rule 2 works.
--
-- Expected lint result:
--   $ ./lint-chain.sh ../lint-fixtures/no-anon-revoke   ->  1 finding, exit 1
--

CREATE TABLE IF NOT EXISTS public.payments_fixture (
    id          bigserial PRIMARY KEY,
    order_id    integer NOT NULL,
    amount      numeric NOT NULL,
    method      text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- The missing lines that would make this fixture pass:
--   REVOKE ALL ON TABLE public.payments_fixture FROM PUBLIC;
--   REVOKE ALL ON TABLE public.payments_fixture FROM anon, authenticated;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payments_fixture TO service_role;
