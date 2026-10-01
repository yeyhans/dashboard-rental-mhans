-- FIXTURE — not part of the migration chain. Feeds rule 3 of `lint-chain.sh`.
--
-- Expected: `./lint-chain.sh ../lint-fixtures/no-role-guard` exits 1 and reports one finding.
--
-- What it reproduces (prod-parity audit, 2026-08-19): every relation in production's `public`
-- schema is owned by `supabase_admin`, and the `postgres` role there is NOT a superuser and NOT a
-- member of `supabase_admin`. A privilege migration executed as `postgres` therefore does not
-- apply — and the first statement below is the dangerous shape, because
--
--     REVOKE INSERT ON public.orders FROM anon;
--
-- run by a non-owner returns the tag `REVOKE` with only a `WARNING: no privileges could be
-- revoked`. psql exits 0. The operator reads success; anon keeps every privilege it had.
--
-- Reproduced against staging at production role parity — see
-- `openspec/changes/consolidado-web-2027/ops/prod-parity-audit-2026-08-19.md`.
--
-- The fix a real migration must carry is the guard block that rule 3 looks for: a `pg_has_role`
-- assertion on `supabase_admin` that raises before any privilege statement runs.

SET lock_timeout = '5s';

BEGIN;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.orders FROM anon;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

COMMIT;
