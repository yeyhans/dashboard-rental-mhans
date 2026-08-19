--
-- 0005_revoke_public_default_privileges.sql — remove `anon`/`authenticated` from the default
-- privileges on schema `public` (closes Finding 1 of rehearsals/0004.md)
--
-- SDD artifacts (design.md, specs/*, audits/, rehearsals/) live at the mhans workspace root:
-- ../../../openspec/changes/consolidado-web-2027/ (OUTSIDE this repo — not visible from a
-- clone of `dashboard/` alone; see R2-003).
--
-- THE ROOT CAUSE. `0001_m1_grants_rls.sql` revoked anon/authenticated writes on the eight tables
-- that existed when it was written. That is a patch on instances, not on the factory. The factory
-- is `pg_default_acl`, verified live against production 2026-08-19:
--
--   schema public, objtype 'r' (tables), grantor postgres:
--     {postgres=arwdDxt, anon=arwdDxt, authenticated=arwdDxt, service_role=arwdDxt, hermes_ro=r}
--   schema public, objtype 'r' (tables), grantor supabase_admin:
--     {postgres=arwdDxt, anon=arwdDxt, authenticated=arwdDxt, service_role=arwdDxt, hermes_ro=r}
--
-- `arwdDxt` is the complete table privilege set: INSERT, SELECT, UPDATE, DELETE, TRUNCATE,
-- REFERENCES, TRIGGER. So **every future table in `public` is born fully writable — including
-- TRUNCATE — by `anon`**, from both grantors, with no line in any migration to review.
-- `0002_hermes_least_privilege.sql` removed only the `hermes_ro=r` entry; it left the far larger
-- anon/authenticated grants untouched. (Note the two `hermes_ro=r` entries above are the
-- pre-`0002` state as still observed in production, which has not yet had `0002` applied.)
--
-- WHY THIS IS NOT REDUNDANT WITH `0004`. `0004_serialised_assets.sql:93-94` does the right thing
-- per-table (`REVOKE ALL ... FROM PUBLIC` then `FROM anon, authenticated`), and rehearsals/0004.md
-- proved the result: `anon` gets `permission denied`, not zero rows. But nothing MAKES the next
-- author write those two lines, and the failure mode is silent — a new table missing the REVOKE is
-- indistinguishable in review from one that never needed it. This migration inverts that: the
-- per-table REVOKE becomes belt-and-braces instead of load-bearing.
--
-- GRANTOR — the same trap documented at length in `0002`'s header applies verbatim here.
-- `ALTER DEFAULT PRIVILEGES` entries are keyed by (grantor role, schema, object type). A REVOKE
-- whose `FOR ROLE` does not match the grantor of the original GRANT removes NOTHING and raises NO
-- ERROR. Production carries entries under BOTH `postgres` and `supabase_admin`; both are revoked
-- below. Doing only one would leave every table created by the other owner born anon-writable —
-- exactly the defect this migration exists to remove.
--
-- EXECUTION ROLE: `ALTER DEFAULT PRIVILEGES FOR ROLE <r>` requires the executing role to BE `<r>`
-- or be a member of it. Apply as a superuser (or as a role holding membership in both `postgres`
-- and `supabase_admin`); running as plain `postgres` without `supabase_admin` membership fails
-- partway with "must be a member of role". Same requirement as `0002`.
--
-- SCOPE — roles deliberately NOT touched:
--   * `service_role` — `rolbypassrls = true` and the dashboard's entire service layer
--     (`supabaseAdmin`) runs as it. Removing its default privileges would make every future table
--     invisible to the admin panel until granted, which is friction with no security gain: the
--     role is full-access by design and its key is server-side only.
--   * `postgres` — the owner/superuser path used by the migration chain itself.
--   * `hermes_ro` — already handled by `0002`; re-revoking would be a no-op but would muddy which
--     migration owns that posture.
--
-- ---------------------------------------------------------------------------
-- SEQUENCES: revoked. Live state (both grantors): `anon=rwU`, `authenticated=rwU` — that is
-- SELECT, UPDATE and USAGE on every future sequence. USAGE/UPDATE is what permits `nextval()` and
-- `setval()`, so an unrevoked default lets `anon` burn or rewind a future table's ID sequence even
-- when it cannot read the table itself. Same "born writable" defect, one object type over.
--
-- Verified this breaks nothing that exists: default privileges apply ONLY to objects created after
-- the ALTER, so every current sequence keeps the grants it already has. The two legitimate
-- `authenticated` write paths (INSERT on `orders` and `order_communications`, per R1-001 /
-- audits/authenticated-write-paths.md) use `orders_id_seq` and `order_communications_id_seq`,
-- which already exist and are untouched.
--
-- Forward cost, stated plainly because it WILL bite someone: every user table in `public` except
-- `admin_users` uses old-style `serial` (`DEFAULT nextval(...)`), not `GENERATED AS IDENTITY`
-- (verified live). Identity columns need no separate sequence privilege; `serial` columns do. So a
-- future table with a `serial` PK that `authenticated` must INSERT into needs TWO grants, not one,
-- and granting only the table produces `ERROR: permission denied for sequence <name>`. That is a
-- loud, precise error rather than a silent wrong result — an acceptable trade. Prefer
-- `GENERATED BY DEFAULT AS IDENTITY` in new tables and the problem does not arise.
--
-- ---------------------------------------------------------------------------
-- FUNCTIONS: deliberately NOT revoked, because doing so would be security theatre. The default ACL
-- does carry `anon=X` and `authenticated=X` (EXECUTE) for objtype 'f'. But PostgreSQL ALSO grants
-- EXECUTE to PUBLIC on every new function as a built-in default that is not represented in
-- `pg_default_acl`, and `anon`/`authenticated` are members of PUBLIC. Confirmed empirically on
-- production rather than reasoned from the docs — every function in `public` carries a leading
-- PUBLIC entry:
--
--   validate_coupon.proacl =
--     {=X/supabase_admin,supabase_admin=X/...,postgres=X/...,anon=X/...,authenticated=X/...,service_role=X/...}
--      ^^ empty grantee = PUBLIC
--
-- Revoking the named `anon`/`authenticated` entries would therefore change the catalog and change
-- nothing about who can execute: both roles would keep EXECUTE via PUBLIC. Actually denying them
-- requires `REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`, which is a materially larger and riskier
-- change — it would cover trigger helpers, extension shims, and the PostgREST RPCs the public site
-- calls (`validate_coupon`, `get_available_shipping_methods`, `search_products_advanced`, ...) —
-- and it needs its own audit of every RPC call site before anyone writes it. Out of scope here;
-- raise it as a separate task rather than smuggling a half-measure into this migration.
--
-- ---------------------------------------------------------------------------
-- TRADEOFF — READ THIS BEFORE YOUR NEXT `CREATE TABLE`. After this migration, a newly created
-- table in `public` is NOT reachable through PostgREST at all. `GET /rest/v1/your_new_table`
-- returns `401`/`403` with SQLSTATE `42501 permission denied`, for anon and for logged-in users
-- alike, until someone writes an explicit `GRANT` in a migration. **That is the intended posture,
-- not a bug** — deny by default, every grant a reviewed line — but it looks exactly like a broken
-- deployment to whoever hits it first without knowing. The same note is recorded in
-- `RESTORE_RUNBOOK.md` under the apply procedure. If your new table is meant to be readable by the
-- public site, say so out loud in SQL:
--
--     GRANT SELECT ON TABLE public.your_new_table TO anon, authenticated;
--     -- plus a policy, or RLS will still return zero rows (see 0001's header)
--
-- Remember the pairing rule from `0002`/ADR-D8: a GRANT without a matching RLS policy returns zero
-- rows with NO error. Grant and policy are one change, not two.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- =========================================================================
-- 1. TABLES — the exposure. Both grantors, both roles (see GRANTOR note in the header).
-- `REVOKE ALL` is exact here, not approximate: the live grant is `arwdDxt`, which IS the complete
-- table privilege set, so this removes precisely what is there and nothing is left behind.
-- =========================================================================
ALTER DEFAULT PRIVILEGES FOR ROLE postgres       IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres       IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;

-- =========================================================================
-- 2. SEQUENCES — nextval/setval on future ID sequences (see SEQUENCES note in the header).
-- Live grant is `rwU`, which is the complete sequence privilege set, so `ALL` is again exact.
-- =========================================================================
ALTER DEFAULT PRIVILEGES FOR ROLE postgres       IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres       IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;

-- FUNCTIONS: intentionally absent. See the FUNCTIONS note in the header — revoking the named
-- entries leaves EXECUTE in place via PUBLIC, so it would be a catalog change with no effect.

COMMIT;

-- =========================================================================
-- Post-apply assertion (test-first artifact). Both queries MUST return 0 rows.
--
-- 1. No default privilege on `public` tables or sequences mentions anon/authenticated:
--
--   SELECT pg_get_userbyid(d.defaclrole) AS grantor,
--          d.defaclobjtype              AS objtype,
--          pg_get_userbyid(a.grantee)   AS grantee,
--          a.privilege_type
--   FROM pg_default_acl d
--   JOIN pg_namespace n ON n.oid = d.defaclnamespace
--   CROSS JOIN LATERAL aclexplode(d.defaclacl) a
--   WHERE n.nspname = 'public'
--     AND d.defaclobjtype IN ('r', 'S')
--     AND pg_get_userbyid(a.grantee) IN ('anon', 'authenticated');
--
--   Before this migration: 14 rows for tables (7 privileges x 2 roles) per grantor, plus 3 x 2 per
--   grantor for sequences. After: 0.
--
-- 2. `service_role` must SURVIVE — this one must return 4 rows (2 grantors x {tables, sequences}),
--    not 0. A 0 here means the revoke was written too broadly and the dashboard's service layer
--    will lose access to every future table:
--
--   SELECT pg_get_userbyid(d.defaclrole) AS grantor, d.defaclobjtype
--   FROM pg_default_acl d
--   JOIN pg_namespace n ON n.oid = d.defaclnamespace
--   CROSS JOIN LATERAL aclexplode(d.defaclacl) a
--   WHERE n.nspname = 'public'
--     AND d.defaclobjtype IN ('r', 'S')
--     AND pg_get_userbyid(a.grantee) = 'service_role'
--   GROUP BY 1, 2;
--
-- 3. End-to-end, the check that actually proves it: create a scratch table as EACH grantor, assert
--    `has_table_privilege('anon', ..., 'INSERT')` is false, drop it. Per-grantor scratch tables are
--    the technique that caught the grantor-mismatch trap during the 0002 rehearsal — a single
--    scratch table only ever proves the posture for whichever role happened to own it.
-- =========================================================================
