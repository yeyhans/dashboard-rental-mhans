# Restore Runbook — migration chain (`0000_baseline.sql`, `0001_m1_grants_rls.sql`)

SDD artifacts (design.md, specs/*, audits/, rehearsals/) live at the mhans workspace root:
`../../../openspec/changes/consolidado-web-2027/` (outside this repo, see R2-003).

## Restoring `0000_baseline.sql` onto a fresh instance

### Prerequisite

A freshly bootstrapped Supabase-image PostgreSQL instance (the `auth`/`storage`/`extensions`
schemas and `pgsodium`/`pgjwt`/`uuid-ossp`/`pg_graphql` already present). `0000_baseline.sql`
does not create these — restoring it onto a bare `postgres:15` image will fail.

### Steps

1. **Connect as `supabase_admin`, not `postgres`.** On this Supabase self-hosted image,
   `supabase_admin` is the actual superuser (`rolsuper = true`) and `postgres` is a regular
   role with **no membership in `supabase_admin`**
   (`pg_has_role('postgres','supabase_admin','MEMBER')` is `false`, verified 2026-08-18).
   `0000_baseline.sql` contains `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin ...`
   statements (captured as-is from production, per ADR-D5) that fail with
   `must be member of role "supabase_admin"` when run as `postgres`.

2. **Apply the migration inside a single transaction (R4-001).** `0000_baseline.sql` has no
   internal `BEGIN`/`COMMIT` (it is a `pg_dump` body, not a hand-wrapped script), so a mid-file
   failure without `--single-transaction` leaves a **partial schema** — some tables/functions
   created, others not, with no automatic rollback. `--single-transaction` makes `psql` wrap the
   whole file in one transaction and roll back entirely on any error, matching the "verify
   idempotently or don't apply at all" DR expectation. Verified 2026-08-18 on a disposable
   database: `0000_baseline.sql` contains no statement that is illegal inside a transaction
   block (no `CREATE INDEX CONCURRENTLY`, `CREATE DATABASE`, `VACUUM`, or `ALTER TYPE ... ADD
   VALUE` — grepped and confirmed absent) — it survives `--single-transaction` cleanly, 0 errors.
   ```
   psql -U supabase_admin -d <target_db> --single-transaction -v ON_ERROR_STOP=1 -f 0000_baseline.sql
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

## Production apply procedure (R4-002, R4-004)

No `supabase config.toml`/CLI exists in this repo (self-hosted Dokploy stack, not Supabase
Cloud) — there is no `supabase db push` command. The migration chain is applied by hand with
`psql`, in numeric order, following this procedure for **every** migration from `0001` onward
(`0000_baseline.sql` is restore-only, see above — it is never applied to an existing database
that already carries this schema, i.e. never to production).

### Why this needs a documented procedure, not just "run the file"

`0001_m1_grants_rls.sql` runs `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, which takes an
**ACCESS EXCLUSIVE** lock on the table. If a long-lived connection already holds any lock on
`orders` (a Hermes session, a PostgREST connection mid-request, a stuck dashboard transaction),
the `ALTER TABLE` blocks waiting for it — and because Postgres locks are FIFO per relation,
every subsequent request against that table (including plain `SELECT`s) queues up **behind**
the blocked `ALTER TABLE`, not around it. Without a lock timeout, one long-lived connection can
silently stall all `orders` traffic for the duration of that connection, with no visible error
until something times out client-side minutes later.

### Operator checklist

1. **Announce a short maintenance window.** `0001` is grants/RLS only — the design's ADR-D6
   Testing Strategy table classifies it as not requiring the full order-write freeze `0003`
   (the M4 state migration) needs, but a brief window (10-15 min) where checkout/order-writes
   are expected to be quiet reduces the chance of hitting the lock scenario above. This is
   advisory, not the hard freeze `0003`'s ADR-D9 sequence requires.
2. **Take a backup first**, always, regardless of the migration's own rollback story:
   ```
   docker exec supabase-9cd8-db pg_dump -U postgres -Fc -d postgres > mhans-pre-0001-$(date +%Y%m%d).dump
   ```
   Verify it restores (`pg_restore --list`) before proceeding.
3. **Apply with the lock/statement timeouts already embedded in the migration file itself**
   (`SET lock_timeout = '5s'; SET statement_timeout = '30s';` at the top of `0001_m1_grants_rls.sql`,
   R4-002 fix) — this makes a blocked `ALTER TABLE` fail fast with a clear
   `ERROR: canceling statement due to lock timeout` instead of hanging indefinitely and forming
   a queue behind it:
   ```
   psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -f 0001_m1_grants_rls.sql
   ```
   Do **not** add `--single-transaction` here — `0001_m1_grants_rls.sql` already wraps itself in
   its own `BEGIN`/`COMMIT` (verified 2026-08-18: combining both produces a harmless
   `WARNING: there is no transaction in progress` at the trailing `COMMIT`, but the extra flag
   adds nothing since the file is already atomic).
4. **On lock-timeout failure, retry — do not force it.** A `lock timeout` error means the
   transaction was cleanly rolled back (no partial state, `0001` is self-wrapped in
   `BEGIN`/COMMIT`) and it is safe to simply re-run step 3. If it fails repeatedly, the blocking
   session is not transient — identify and stop it deliberately (e.g. a stuck Hermes container:
   `docker stop hermes-mhans-main hermes-mhans-notifier hermes-mhans-dashboard`, matching the
   ADR-D9 precedent for *why* Hermes containers are stopped during schema changes) rather than
   raising the timeout, which would just convert a fast, safe failure into the exact silent
   FIFO-stall this timeout exists to prevent.
5. **Run the assertion scripts** (see "Post-apply health checks" below).
6. **Rollback trigger**: `0001_m1_grants_rls.down.sql`, same operator flow (steps 3-5 with the
   down file). Restore from the step-2 backup only if the down script itself fails a
   post-condition check — `0001`'s down is schema/grants-only (no data-destroying operation), so
   a full restore should not be necessary in the ordinary case.

## Post-apply health checks (R4-005)

Run immediately after any apply (forward or rollback) of `0001` or later:

1. **Assertion scripts** — the 5 rewritten `hermes-mhans/scripts/setup-*.sh` (T-006) now double
   as post-apply health checks: they assert trigger/role/grant/policy state and exit non-zero on
   drift. Run all 5; a non-zero exit from any of them means the apply did not produce the state
   the migration chain declares, and should be investigated before considering the apply
   complete, in addition to and independent of the migration's own `ON_ERROR_STOP=1` exit code.
2. **Anon-privilege check** (should be `f` for all 32 table x privilege combinations from
   `openspec/.../audits/anon-write-paths.md`):
   ```sql
   SELECT t, p, has_table_privilege('anon', 'public.'||t, p)
   FROM unnest(ARRAY['orders','products','categories','coupons','shipping_methods',
                      'order_communications','hermes_notifications','hermes_pending_writes']) t,
        unnest(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE']) p;
   ```
3. **RLS-enabled check** (should be `true` for all 8 rows):
   ```sql
   SELECT relname, relrowsecurity FROM pg_class
   WHERE relname IN ('orders','products','categories','coupons','shipping_methods',
                      'order_communications','hermes_notifications','hermes_pending_writes');
   ```
4. **Policy-count sanity check** (should be >= 1 per table, 18 total per the current migration):
   ```sql
   SELECT tablename, count(*) FROM pg_policies WHERE schemaname='public'
     AND tablename IN ('orders','products','categories','coupons','shipping_methods',
                        'order_communications','hermes_notifications','hermes_pending_writes')
   GROUP BY tablename;
   ```
5. **Live smoke** — one real anon-JWT negative probe (an INSERT attempt via the public
   PostgREST/Kong endpoint using the anon key, expect 401/403) and one real authenticated
   checkout, per `grants-rls-closure/spec.md`'s production scenario (T-014, not yet executed —
   see `rehearsals/0001.md` for why).

## Known gap: `on_auth_user_created` is schema-`auth`, not `public`

`pg_dump -n public` (used to scope this baseline to the application schema) does not emit
triggers defined in the `auth` schema. `auth.users on_auth_user_created` calls
`public.handle_new_user()` and CASCADE-drops whenever `handle_new_user()` is dropped/recreated.
It is appended manually at the end of `0000_baseline.sql`, after `handle_new_user()` is
defined, with the same `DROP TRIGGER IF EXISTS` convention as the Hermes trigger. If a future
baseline regeneration re-scopes the dump, re-check for this trigger specifically — `pg_dump`
will not surface it as a diff against a `-n public`-only comparison.
