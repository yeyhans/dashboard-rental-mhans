--
-- 0005_revoke_public_default_privileges.down.sql
--
-- SDD artifacts live at ../../../openspec/changes/consolidado-web-2027/ (outside this repo,
-- see R2-003).
--
-- Rollback for 0005_revoke_public_default_privileges.sql (ADR-D5 `.down.sql` convention).
--
-- GENERATED FROM THE LIVE ACL, NOT GUESSED. Read from production via the read-only `mhans-db` MCP
-- on 2026-08-19, `pg_default_acl` joined to `pg_namespace` for `nspname = 'public'`:
--
--   objtype 'r', grantor postgres:
--     {postgres=arwdDxt/postgres, anon=arwdDxt/postgres, authenticated=arwdDxt/postgres,
--      service_role=arwdDxt/postgres, hermes_ro=r/postgres}
--   objtype 'r', grantor supabase_admin:
--     {postgres=arwdDxt/supabase_admin, anon=arwdDxt/supabase_admin,
--      authenticated=arwdDxt/supabase_admin, service_role=arwdDxt/supabase_admin,
--      hermes_ro=r/supabase_admin}
--   objtype 'S', grantor postgres:
--     {postgres=rwU/postgres, anon=rwU/postgres, authenticated=rwU/postgres,
--      service_role=rwU/postgres}
--   objtype 'S', grantor supabase_admin:
--     {postgres=rwU/supabase_admin, anon=rwU/supabase_admin, authenticated=rwU/supabase_admin,
--      service_role=rwU/supabase_admin}
--
-- `arwdDxt` (INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER) is the complete table
-- privilege set and `rwU` (SELECT, UPDATE, USAGE) is the complete sequence privilege set, so
-- `GRANT ALL` below restores the observed state EXACTLY — no privilege is added that was not there
-- and none is omitted. This is the one case where `ALL` is precise rather than lazy, and it is why
-- the up-migration could use `REVOKE ALL` symmetrically.
--
-- Restores only what 0005 removed: `anon` and `authenticated`, on TABLES and SEQUENCES, under both
-- grantors. It does NOT touch `service_role`, `postgres`, `hermes_ro` or FUNCTIONS, because 0005
-- did not touch them either.
--
-- SECURITY note, not a data-loss note: this rollback deliberately restores the factory defect.
-- With it in effect, every table created in `public` is once again born with `anon` holding
-- INSERT, UPDATE, DELETE and TRUNCATE, silently, with no migration line to review — the exact
-- mechanism behind `audits/anon-write-paths.md` and Finding 1 of `rehearsals/0004.md`. Do not park
-- the chain here. While this rollback is in effect, every new table MUST carry its own
-- `REVOKE ALL ... FROM anon, authenticated` (the pattern in `0004_serialised_assets.sql:93-94`),
-- and the `lint-chain.sh` anon-REVOKE rule becomes load-bearing rather than belt-and-braces.
--
-- GRANTOR: the `FOR ROLE` clauses must mirror 0005's REVOKEs (and therefore the original grants) —
-- see the 0005 header. Same execution-role requirement: superuser, or a role holding membership in
-- both `postgres` and `supabase_admin`.
--
-- Idempotent: `ALTER DEFAULT PRIVILEGES ... GRANT` is a no-op when the privilege is already
-- present, so a re-run is safe.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- =========================================================================
-- ROLE GUARD (prod-parity audit, 2026-08-19). Runs FIRST, inside the transaction.
--
-- Every relation in production's `public` schema is owned by `supabase_admin`, and the `postgres`
-- role there is NOT a superuser and NOT a member of `supabase_admin` (staging had it as superuser,
-- which is why the rehearsals passed and hid this). Executed as `postgres`, this migration:
--   * ALTER TABLE / ALTER VIEW / CREATE POLICY -> ERROR: must be owner of ...
--   * ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin -> ERROR: must be member of role ...
--   * REVOKE ... FROM anon -> returns the tag `REVOKE` with only `WARNING: no privileges could be
--     revoked`, changing nothing while psql exits 0.
--
-- That last one is the reason this guard exists: without it the wrong-role apply reports success
-- and leaves anon holding every privilege the migration claims to have removed.
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

-- ---- tables (both grantors, as captured live above) ----
ALTER DEFAULT PRIVILEGES FOR ROLE postgres       IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres       IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;

-- ---- sequences (both grantors, as captured live above) ----
ALTER DEFAULT PRIVILEGES FOR ROLE postgres       IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres       IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;

COMMIT;
