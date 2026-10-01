import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Static assertions over `0009_asset_tags.sql`, which gives `serialised_assets` the internal
 * asset tag the label roll is printed with.
 *
 * The tag (`MH-00001`) is the identifier the operator scans during the physical count — the
 * label is stuck on the unit BEFORE its serial is typed, and both the QR code and the Code 128 on
 * the label encode the tag, never the manufacturer serial. Three properties make that work and
 * each is pinned here: the format is fixed (a CHECK mirroring `ASSET_TAG_PATTERN` in
 * `src/lib/assetTag.ts`), a tag is never reused (UNIQUE), and every unit has one (NOT NULL, after
 * a backfill from `id` for rows entered before the roll existed).
 *
 * Vitest has no database: these are text assertions over the SQL. The runtime proof is the
 * staging rehearsal, following the 0004/0006/0007/0008 pattern.
 */
function read(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

function executableSql(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
}

const migration = read('../0009_asset_tags.sql');
const rollback = read('../0009_asset_tags.down.sql');
const migrationSql = executableSql(migration);
const rollbackSql = executableSql(rollback);

describe('0009_asset_tags migration', () => {
  it('guards execution as supabase_admin, per prod-parity audit convention', () => {
    expect(migrationSql).toMatch(/pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i);
  });

  it('wraps forward and rollback in a transaction, like the rest of the chain', () => {
    expect(migrationSql).toMatch(/^\s*BEGIN;/m);
    expect(migrationSql).toMatch(/^\s*COMMIT;/m);
    expect(rollbackSql).toMatch(/^\s*BEGIN;/m);
    expect(rollbackSql).toMatch(/^\s*COMMIT;/m);
  });

  it('sets lock_timeout and statement_timeout like its siblings', () => {
    expect(migrationSql).toMatch(/SET\s+lock_timeout/i);
    expect(migrationSql).toMatch(/SET\s+statement_timeout/i);
  });

  describe('the column', () => {
    it('adds asset_tag to public.serialised_assets, idempotently', () => {
      expect(migrationSql).toMatch(
        /ALTER TABLE(\s+ONLY)?\s+public\.serialised_assets[\s\S]*?ADD COLUMN IF NOT EXISTS\s+asset_tag\s+text/i
      );
    });

    it('backfills existing units from their id, and only where no tag was assigned', () => {
      expect(migrationSql).toMatch(
        /UPDATE\s+public\.serialised_assets[\s\S]*?SET\s+asset_tag\s*=\s*'MH-'\s*\|\|\s*lpad\(id::text,\s*5,\s*'0'\)[\s\S]*?WHERE\s+asset_tag\s+IS\s+NULL/i
      );
    });

    it('makes the tag NOT NULL only after the backfill', () => {
      const backfillAt = migrationSql.search(/UPDATE\s+public\.serialised_assets/i);
      const notNullAt = migrationSql.search(/ALTER COLUMN\s+asset_tag\s+SET NOT NULL/i);
      expect(backfillAt).toBeGreaterThan(-1);
      expect(notNullAt).toBeGreaterThan(backfillAt);
    });
  });

  describe('the invariants', () => {
    it('enforces the exact format the application validates: ^MH-[0-9]{5}$', () => {
      expect(migrationSql).toMatch(/CHECK\s*\(\s*asset_tag\s*~\s*'\^MH-\[0-9\]\{5\}\$'\s*\)/);
    });

    it('never reuses a tag — a named UNIQUE index the 23505 handler can match', () => {
      expect(migrationSql).toMatch(
        /CREATE UNIQUE INDEX IF NOT EXISTS\s+serialised_assets_asset_tag_key\s+ON\s+public\.serialised_assets\s*\(\s*asset_tag\s*\)/i
      );
    });

    it('names the CHECK after its column and guards it with a pg_constraint lookup', () => {
      expect(migrationSql).toMatch(/CONSTRAINT\s+serialised_assets_asset_tag_format_check/i);
      expect(migrationSql).toMatch(/pg_constraint/i);
    });
  });

  describe('scope — one column, no privilege or RLS drift', () => {
    it('grants hermes_ro nothing (isolation invariant of the chain)', () => {
      const grantsToHermesRo = /\bGRANT\b[^;]*\bhermes_ro\b/i;
      expect(migrationSql).not.toMatch(grantsToHermesRo);
      expect(rollbackSql).not.toMatch(grantsToHermesRo);
    });

    it('issues no GRANT and no RLS change at all', () => {
      expect(migrationSql).not.toMatch(/\bGRANT\b/i);
      expect(migrationSql).not.toMatch(/ENABLE ROW LEVEL SECURITY/i);
      expect(migrationSql).not.toMatch(/CREATE POLICY/i);
    });

    it('creates no table and drops nothing — it only widens serialised_assets', () => {
      expect(migrationSql).not.toMatch(/CREATE TABLE/i);
      expect(migrationSql).not.toMatch(/DROP\s+(TABLE|COLUMN|INDEX)/i);
    });
  });

  describe('rollback', () => {
    it('drops exactly that column, idempotently', () => {
      expect(rollbackSql).toMatch(/DROP COLUMN IF EXISTS\s+asset_tag/i);
    });

    it('guards ownership the same way the forward migration does', () => {
      expect(rollbackSql).toMatch(/pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i);
    });

    it('touches nothing but that column', () => {
      expect(rollbackSql).not.toMatch(/DROP TABLE/i);
      expect(rollbackSql).not.toMatch(/UPDATE\s+public\.serialised_assets/i);
    });

    it('documents the data loss a real-label tag suffers on rollback', () => {
      expect(rollback).toMatch(/DATA LOSS/);
    });
  });
});
