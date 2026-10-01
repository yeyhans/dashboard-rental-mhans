import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * T-018. Static assertions over `0003_m4_status_portal_v12.sql`, the M4 state migration
 * (`order-state-machine/spec.md`).
 *
 * Vitest has no database, so these read the SQL text. The runtime proof — that the row counts per
 * mapped value survive the `CASE` and that `.down.sql` restores exactly — is the staging rehearsal
 * recorded in `rehearsals/0003.md`. Both halves are required and neither substitutes for the
 * other: the text assertions catch a source value silently dropped from the `CASE` during review,
 * the rehearsal catches a mapping that parses but moves the wrong rows.
 *
 * The mapping under test, from the spec's "Existing orders are migrated without orphans":
 *
 *   completed  -> completed
 *   cancelled  -> cancelled
 *   failed     -> cancelled  + cancellation_reason
 *   on-hold    -> request
 *   processing -> confirmed
 *   pending    -> request
 *   refunded   -> cancelled  + cancellation_reason
 *
 * `pending` and `refunded` carry zero rows today. They are covered anyway because the live CHECK
 * constraint permits them: an uncovered permitted value aborts the migration mid-window if a row
 * arrives with it between authoring and applying, and orders are still being taken.
 */
function read(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

/**
 * Strips `--` comment lines before matching. These migrations carry long rationale headers that
 * quote the very SQL they discuss, so an assertion run over the raw text passes on the prose
 * describing a statement that was never written. Same reason `lint-chain.sh` strips comments.
 */
function executableSql(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
}

const migration = read('../0003_m4_status_portal_v12.sql');
const rollback = read('../0003_m4_status_portal_v12.down.sql');
const migrationSql = executableSql(migration);
const rollbackSql = executableSql(rollback);

/** The eight values of the Portal Cliente v1.2 vocabulary (ADR-001). */
const V12_STATUSES = [
  'request',
  'evaluation',
  'confirmed',
  'preparation',
  'in-rental',
  'return',
  'completed',
  'cancelled',
] as const;

/** Every value the live production CHECK constraint permits today. */
const LEGACY_STATUSES = [
  'pending',
  'processing',
  'on-hold',
  'completed',
  'cancelled',
  'refunded',
  'failed',
] as const;

const BACKUP_TABLE = 'orders_status_backup_20260817';

describe('0003_m4_status_portal_v12 — forward migration', () => {
  it('runs as supabase_admin, because orders is owned by supabase_admin in production', () => {
    // Without this guard, ALTER TABLE errors outright — but a REVOKE would report success and
    // change nothing. Enforced for the whole chain by lint-chain.sh rule 3.
    expect(migrationSql).toMatch(/pg_has_role\(\s*current_user\s*,\s*'supabase_admin'/i);
  });

  it('is wrapped in a single transaction, so a mid-way abort leaves no half-migrated table', () => {
    expect(migrationSql).toMatch(/^\s*BEGIN;/m);
    expect(migrationSql).toMatch(/^\s*COMMIT;/m);
  });

  it('adds cancellation_reason so the failed/cancelled distinction is not lost', () => {
    expect(migrationSql).toMatch(
      /ALTER TABLE\s+public\.orders\s+ADD COLUMN (IF NOT EXISTS )?cancellation_reason\s+text/i
    );
  });

  it('snapshots (id, status) into a backup table before touching any row', () => {
    expect(migrationSql).toMatch(
      new RegExp(`CREATE TABLE (IF NOT EXISTS )?public\\.${BACKUP_TABLE}`, 'i')
    );
    // The backup must be captured BEFORE the UPDATE, otherwise it records the post-migration
    // values and .down.sql restores the migration onto itself.
    const backupAt = migrationSql.search(new RegExp(BACKUP_TABLE, 'i'));
    const updateAt = migrationSql.search(/UPDATE\s+public\.orders/i);
    expect(backupAt).toBeGreaterThan(-1);
    expect(updateAt).toBeGreaterThan(-1);
    expect(backupAt).toBeLessThan(updateAt);
  });

  it('locks the backup table away from anon and authenticated', () => {
    // pg_default_acl grants anon the full table privilege set on every new table in public until
    // 0005 lands, and this migration may be applied before it. lint-chain rule 2 covers the same
    // ground; asserted here too so the reason travels with the migration.
    expect(migrationSql).toMatch(new RegExp(`REVOKE ALL[\\s\\S]*${BACKUP_TABLE}`, 'i'));
    expect(migrationSql).toMatch(/REVOKE ALL[\s\S]*\banon\b/i);
  });

  it.each(LEGACY_STATUSES)('maps the CHECK-permitted source value %s', (legacy) => {
    // Matching WHEN ... 'value' rather than a bare occurrence: the value must appear as a mapped
    // branch, not merely somewhere in the file.
    expect(migrationSql).toMatch(new RegExp(`WHEN\\s+'${legacy}'\\s*THEN`, 'i'));
  });

  it('maps each source value to its specified target', () => {
    const expectedMapping: Record<string, string> = {
      completed: 'completed',
      cancelled: 'cancelled',
      failed: 'cancelled',
      'on-hold': 'request',
      processing: 'confirmed',
      pending: 'request',
      refunded: 'cancelled',
    };

    for (const [source, target] of Object.entries(expectedMapping)) {
      expect(migrationSql).toMatch(new RegExp(`WHEN\\s+'${source}'\\s+THEN\\s+'${target}'`, 'i'));
    }
  });

  it('populates cancellation_reason for the two values that collapse into cancelled', () => {
    // `failed` and `refunded` both become `cancelled`; without a reason the two are
    // indistinguishable afterwards, which the spec forbids.
    expect(migrationSql).toMatch(/cancellation_reason\s*=[\s\S]*WHEN\s+'failed'\s+THEN/i);
    expect(migrationSql).toMatch(/cancellation_reason\s*=[\s\S]*WHEN\s+'refunded'\s+THEN/i);
  });

  it('asserts the old constraint exists before dropping it', () => {
    // A DROP CONSTRAINT IF EXISTS on a renamed constraint is a silent no-op that leaves the old
    // vocabulary enforced, so the migration would report success and change nothing.
    expect(migrationSql).toMatch(/information_schema\.table_constraints/i);
    expect(migrationSql).toMatch(/orders_status_check/i);
    const assertAt = migrationSql.search(/information_schema\.table_constraints/i);
    const dropAt = migrationSql.search(/DROP CONSTRAINT/i);
    expect(assertAt).toBeLessThan(dropAt);
  });

  it('drops the legacy constraint before writing v1.2 values, not after', () => {
    // Found by the staging rehearsal, 2026-08-19, and invisible to every other assertion in this
    // file: the CHECK is evaluated per row at UPDATE time, so writing 'request' while the legacy
    // seven-value constraint is still attached fails with
    //   ERROR: new row for relation "orders" violates check constraint "orders_status_check"
    // The first draft ordered it assert -> UPDATE -> DROP -> ADD and parsed perfectly.
    const dropAt = migrationSql.search(/DROP CONSTRAINT\s+orders_status_check/i);
    const updateAt = migrationSql.search(/UPDATE\s+public\.orders/i);
    expect(dropAt).toBeGreaterThan(-1);
    expect(dropAt).toBeLessThan(updateAt);
  });

  it('refuses to swap the constraint while any row is outside the v1.2 vocabulary', () => {
    // The count-zero assertion must run AFTER the UPDATE and BEFORE the new CHECK is added;
    // otherwise ADD CONSTRAINT fails on real data mid-window instead of aborting on a clear check.
    expect(migrationSql).toMatch(/RAISE EXCEPTION/i);
    const updateAt = migrationSql.search(/UPDATE\s+public\.orders/i);
    const addAt = migrationSql.search(/ADD CONSTRAINT\s+orders_status_check/i);
    const guardAt = migrationSql.search(/status\s+NOT IN/i);
    expect(guardAt).toBeGreaterThan(updateAt);
    expect(guardAt).toBeLessThan(addAt);
  });

  it.each(V12_STATUSES)('admits %s in the new constraint', (status) => {
    expect(migrationSql).toMatch(
      new RegExp(`ADD CONSTRAINT\\s+orders_status_check[\\s\\S]*'${status}'`, 'i')
    );
  });

  it('admits nothing beyond the eight v1.2 values', () => {
    const clause = migrationSql.match(
      /ADD CONSTRAINT\s+orders_status_check[\s\S]*?;/i
    )?.[0];
    expect(clause).toBeTruthy();

    const admitted = [...(clause as string).matchAll(/'([a-z-]+)'/gi)].map((m) => m[1]);
    expect([...new Set(admitted)].sort()).toEqual([...V12_STATUSES].sort());
  });

  it('rejects every legacy value that is not also a v1.2 value', () => {
    const clause = migrationSql.match(/ADD CONSTRAINT\s+orders_status_check[\s\S]*?;/i)?.[0] ?? '';
    const stillLegacy = LEGACY_STATUSES.filter(
      (s) => !(V12_STATUSES as readonly string[]).includes(s)
    );
    for (const legacy of stillLegacy) {
      expect(clause).not.toMatch(new RegExp(`'${legacy}'`, 'i'));
    }
  });
});

describe('0003_m4_status_portal_v12 — rollback', () => {
  it('runs as supabase_admin and inside a transaction', () => {
    expect(rollbackSql).toMatch(/pg_has_role\(\s*current_user\s*,\s*'supabase_admin'/i);
    expect(rollbackSql).toMatch(/^\s*BEGIN;/m);
    expect(rollbackSql).toMatch(/^\s*COMMIT;/m);
  });

  it('restores status from the pre-migration backup, not from a re-derived mapping', () => {
    // A reverse CASE cannot work: three source values collapse into `cancelled`, so the inverse is
    // ambiguous. Only the (id, status) snapshot can restore exactly.
    expect(rollbackSql).toMatch(new RegExp(`FROM\\s+public\\.${BACKUP_TABLE}`, 'i'));
    expect(rollbackSql).toMatch(/UPDATE\s+public\.orders/i);
  });

  it('fails loudly if the backup table is missing rather than restoring nothing', () => {
    // Without this, a rollback against a database where the backup was dropped updates zero rows
    // and reports success — the same silent no-op family this change keeps running into.
    expect(rollbackSql).toMatch(/to_regclass|RAISE EXCEPTION/i);
  });

  it('restores the prior CHECK constraint with the legacy vocabulary', () => {
    for (const legacy of LEGACY_STATUSES) {
      expect(rollbackSql).toMatch(new RegExp(`'${legacy}'`, 'i'));
    }
  });

  it('refuses a blind restore when post-cutover writes exist', () => {
    expect(rollbackSql).toMatch(/IS DISTINCT FROM CASE/i);
    expect(rollbackSql).toMatch(/RAISE EXCEPTION/i);
  });

  it('offers an override the documented command actually sets', () => {
    // Found on staging, 2026-08-19. The first draft read
    //   current_setting('psql.allow_lossy_rollback', true)
    // and told the operator to pass `-v allow_lossy_rollback=1`. Those are unrelated: `-v` sets a
    // psql CLIENT variable, `current_setting` reads a SERVER GUC. The override silently did
    // nothing and the documented escape hatch was unusable — verified by running it.
    expect(rollbackSql).not.toMatch(/current_setting\(\s*'psql\./i);

    const guc = rollbackSql.match(/current_setting\(\s*'([a-z_]+\.[a-z_]+)'/i)?.[1];
    expect(guc).toBeTruthy();
    // Whatever GUC the code reads must be the one the file tells the operator to set, and it must
    // be set by a mechanism that reaches the server: PGOPTIONS at connect time, or SET.
    expect(rollback).toMatch(new RegExp(`PGOPTIONS[\\s\\S]*${guc as string}`, 'i'));
  });

  it('drops cancellation_reason so a re-apply starts from the pre-migration shape', () => {
    expect(rollbackSql).toMatch(
      /ALTER TABLE\s+public\.orders\s+DROP COLUMN (IF EXISTS )?cancellation_reason/i
    );
  });
});
