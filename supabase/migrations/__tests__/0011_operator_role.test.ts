import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ADMIN_ROLES } from '../../../src/lib/accessControl';

/**
 * Static assertions over `0011_operator_role.sql`, which adds the `operator` role (garage
 * scanning only) and an `is_active` flag to `admin_users`.
 *
 * The role vocabulary is pinned in two places on purpose — the CHECK constraint here and
 * `ADMIN_ROLES` in `src/lib/accessControl.ts` — and this suite asserts they agree, so a role added
 * to one without the other fails a test before it fails a worker at the door.
 *
 * Vitest has no database: these are text assertions over the SQL. The runtime proof is the
 * staging rehearsal, following the 0004–0010 pattern.
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

const migration = read('../0011_operator_role.sql');
const rollback = read('../0011_operator_role.down.sql');
const migrationSql = executableSql(migration);
const rollbackSql = executableSql(rollback);

describe('0011_operator_role migration', () => {
  it('guards execution as supabase_admin, per prod-parity audit convention', () => {
    expect(migrationSql).toMatch(/pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i);
  });

  it('wraps forward and rollback in a transaction, like the rest of the chain', () => {
    expect(migrationSql).toMatch(/^\s*BEGIN;/m);
    expect(migrationSql).toMatch(/^\s*COMMIT;/m);
    expect(rollbackSql).toMatch(/^\s*BEGIN;/m);
    expect(rollbackSql).toMatch(/^\s*COMMIT;/m);
  });

  it('sets lock_timeout and statement_timeout — admin_users is read on every uncached request', () => {
    expect(migrationSql).toMatch(/SET\s+lock_timeout/i);
    expect(migrationSql).toMatch(/SET\s+statement_timeout/i);
  });

  describe('the active flag', () => {
    it('adds is_active as NOT NULL DEFAULT true, idempotently — existing admins stay active', () => {
      expect(migrationSql).toMatch(
        /ALTER TABLE(\s+ONLY)?\s+public\.admin_users[\s\S]*?ADD COLUMN IF NOT EXISTS\s+is_active\s+boolean\s+NOT NULL\s+DEFAULT\s+true/i
      );
    });
  });

  describe('the role vocabulary', () => {
    it('pins role to exactly the roles the application knows', () => {
      const match = migrationSql.match(/CHECK\s*\(\s*role\s+IN\s*\(([^)]*)\)\s*\)/i);
      expect(match).not.toBeNull();
      const sqlRoles = (match?.[1] ?? '')
        .split(',')
        .map((token) => token.trim().replace(/^'|'$/g, ''))
        .sort();
      expect(sqlRoles).toEqual([...ADMIN_ROLES].sort());
    });

    it('names the constraint after the column and guards it with a pg_constraint lookup', () => {
      expect(migrationSql).toMatch(/CONSTRAINT\s+admin_users_role_check/i);
      expect(migrationSql).toMatch(/pg_constraint/i);
    });
  });

  describe('scope — one column and one CHECK, no privilege or RLS drift', () => {
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

    it('creates no table, drops nothing and rewrites no rows', () => {
      expect(migrationSql).not.toMatch(/CREATE TABLE/i);
      expect(migrationSql).not.toMatch(/DROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT)/i);
      expect(migrationSql).not.toMatch(/UPDATE\s+public\.admin_users/i);
    });
  });

  describe('rollback', () => {
    it('drops the CHECK and the column, idempotently', () => {
      expect(rollbackSql).toMatch(/DROP CONSTRAINT IF EXISTS\s+admin_users_role_check/i);
      expect(rollbackSql).toMatch(/DROP COLUMN IF EXISTS\s+is_active/i);
    });

    it('guards ownership the same way the forward migration does', () => {
      expect(rollbackSql).toMatch(/pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i);
    });

    it('touches nothing but that column and constraint', () => {
      expect(rollbackSql).not.toMatch(/DROP TABLE/i);
      expect(rollbackSql).not.toMatch(/DELETE\s+FROM/i);
    });

    it('documents the data loss — deactivated accounts come back to life', () => {
      expect(rollback).toMatch(/DATA LOSS/);
      expect(rollback).toMatch(/is_active = false/);
    });
  });
});
