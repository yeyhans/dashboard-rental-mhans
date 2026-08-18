# Restore Runbook — `0000_baseline.sql`

## Prerequisite

A freshly bootstrapped Supabase-image PostgreSQL instance (the `auth`/`storage`/`extensions`
schemas and `pgsodium`/`pgjwt`/`uuid-ossp`/`pg_graphql` already present). `0000_baseline.sql`
does not create these — restoring it onto a bare `postgres:15` image will fail.

## Steps

1. **Connect as `supabase_admin`, not `postgres`.** On this Supabase self-hosted image,
   `supabase_admin` is the actual superuser (`rolsuper = true`) and `postgres` is a regular
   role with **no membership in `supabase_admin`**
   (`pg_has_role('postgres','supabase_admin','MEMBER')` is `false`, verified 2026-08-18).
   `0000_baseline.sql` contains `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin ...`
   statements (captured as-is from production, per ADR-D5) that fail with
   `must be member of role "supabase_admin"` when run as `postgres`. Always apply as:
   ```
   psql -U supabase_admin -d <target_db> -v ON_ERROR_STOP=1 -f 0000_baseline.sql
   ```

2. **Apply the migration.**
   ```
   psql -U supabase_admin -d <target_db> -v ON_ERROR_STOP=1 -f 0000_baseline.sql
   ```

3. **Provision Hermes role passwords out-of-band** (never in the committed migration):
   ```
   ALTER ROLE hermes_ro PASSWORD '<from secrets store>';
   ALTER ROLE hermes_rw PASSWORD '<from secrets store>';
   ALTER ROLE hermes_notifier PASSWORD '<from secrets store>';
   ```
   Roles are cluster-scoped, not database-scoped — if the target Postgres cluster already has
   these roles (e.g. it is the same cluster as production/staging), step 3 is a no-op; the
   `DO $$ ... IF NOT EXISTS` blocks in `0000_baseline.sql` skip role creation and leave the
   existing password untouched.

4. **Verify** with the assertion queries T-006 rewrote into
   `hermes-mhans/scripts/setup-notifications.sh`, `setup-db-role*.sh`, `setup-rls-hermes.sh`.

## Known gap: `on_auth_user_created` is schema-`auth`, not `public`

`pg_dump -n public` (used to scope this baseline to the application schema) does not emit
triggers defined in the `auth` schema. `auth.users on_auth_user_created` calls
`public.handle_new_user()` and CASCADE-drops whenever `handle_new_user()` is dropped/recreated.
It is appended manually at the end of `0000_baseline.sql`, after `handle_new_user()` is
defined, with the same `DROP TRIGGER IF EXISTS` convention as the Hermes trigger. If a future
baseline regeneration re-scopes the dump, re-check for this trigger specifically — `pg_dump`
will not surface it as a diff against a `-n public`-only comparison.
