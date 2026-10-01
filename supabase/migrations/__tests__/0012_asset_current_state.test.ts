import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Static assertions over `0012_asset_current_state.sql`, the view that answers "what is each
 * unit's latest movement" in the database instead of in a bounded window of rows (R3-101).
 *
 * The ordering clause is the whole point of the view, so it is asserted token by token: without
 * `id DESC` two movements at the same instant resolve non-deterministically.
 *
 * Vitest has no database: text assertions only. The runtime proof is the staging rehearsal.
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

const migration = read('../0012_asset_current_state.sql');
const rollback = read('../0012_asset_current_state.down.sql');
const migrationSql = executableSql(migration);
const rollbackSql = executableSql(rollback);

describe('0012_asset_current_state migration', () => {
  it('guards execution as supabase_admin and wraps everything in a transaction', () => {
    expect(migrationSql).toMatch(/pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i);
    expect(migrationSql).toMatch(/^\s*BEGIN;/m);
    expect(migrationSql).toMatch(/^\s*COMMIT;/m);
    expect(migrationSql).toMatch(/SET\s+lock_timeout/i);
    expect(migrationSql).toMatch(/SET\s+statement_timeout/i);
  });

  describe('the view', () => {
    it('is created idempotently with CREATE OR REPLACE', () => {
      expect(migrationSql).toMatch(/CREATE OR REPLACE VIEW\s+public\.asset_current_state/i);
    });

    it('picks one row per asset by the latest checked_at, with id DESC as the tie-break', () => {
      expect(migrationSql).toMatch(/SELECT DISTINCT ON \(asset_id\)/i);
      expect(migrationSql).toMatch(/FROM\s+public\.asset_movements/i);
      // The exact ORDER BY: asset_id first (DISTINCT ON requires it), then newest, then last inserted.
      expect(migrationSql).toMatch(/ORDER BY\s+asset_id,\s*checked_at DESC,\s*id DESC/i);
    });

    it('exposes the columns the services read', () => {
      const body = migrationSql.match(/SELECT DISTINCT ON \(asset_id\)([\s\S]*?)FROM/i)?.[1] ?? '';
      for (const column of ['asset_id', 'order_id', 'direction', 'checked_at', 'checked_by_admin_id']) {
        expect(body).toMatch(new RegExp(`\\b${column}\\b`));
      }
    });

    it('runs with the caller privileges — no side door to asset_movements', () => {
      expect(migrationSql).toMatch(/security_invoker\s*=\s*true/i);
    });
  });

  describe('privileges — service_role reads, nobody else', () => {
    it('revokes PUBLIC, anon and authenticated on the view', () => {
      expect(migrationSql).toMatch(/REVOKE ALL ON TABLE public\.asset_current_state FROM PUBLIC/i);
      expect(migrationSql).toMatch(/REVOKE ALL ON TABLE public\.asset_current_state FROM anon, authenticated/i);
    });

    it('grants SELECT (and only SELECT) to service_role', () => {
      expect(migrationSql).toMatch(/GRANT SELECT ON TABLE public\.asset_current_state TO service_role/i);
      expect(migrationSql).not.toMatch(/GRANT[^;]*(INSERT|UPDATE|DELETE|ALL)[^;]*asset_current_state/i);
    });

    it('grants hermes_ro nothing (isolation invariant of the chain)', () => {
      const grantsToHermesRo = /\bGRANT\b[^;]*\bhermes_ro\b/i;
      expect(migrationSql).not.toMatch(grantsToHermesRo);
      expect(rollbackSql).not.toMatch(grantsToHermesRo);
    });
  });

  it('creates no table and touches no existing relation', () => {
    expect(migrationSql).not.toMatch(/CREATE\s+TABLE/i);
    expect(migrationSql).not.toMatch(/ALTER\s+TABLE/i);
    expect(migrationSql).not.toMatch(/DROP\s+/i);
  });

  describe('rollback', () => {
    it('drops the view idempotently, under the same role guard', () => {
      expect(rollbackSql).toMatch(/DROP VIEW IF EXISTS\s+public\.asset_current_state/i);
      expect(rollbackSql).toMatch(/pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i);
    });

    it('touches nothing else', () => {
      expect(rollbackSql).not.toMatch(/DROP TABLE/i);
      expect(rollbackSql).not.toMatch(/DELETE\s+FROM/i);
      expect(rollbackSql).not.toMatch(/asset_movements/i);
    });
  });
});
