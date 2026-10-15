import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Static assertions over `0022_shipping_usage_return_driver.sql`: a nullable
 * `shipping_usage.return_driver_name` for the driver who brings the equipment back, capped the
 * same way as `driver_name` (0017), with NULL meaning the delivery driver also does the return.
 *
 * Vitest has no database: text assertions only. The runtime proof is a rehearsal on a disposable
 * database, which needs separate authorization.
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

const migration = read('../0022_shipping_usage_return_driver.sql');
const rollback = read('../0022_shipping_usage_return_driver.down.sql');
const delivery0017 = read('../0017_shipping_usage_driver_name.sql');
const migrationSql = executableSql(migration);
const rollbackSql = executableSql(rollback);
const delivery0017Sql = executableSql(delivery0017);

function checkExpression(sql: string, constraint: string): string {
  const match = sql.match(
    new RegExp(`ADD CONSTRAINT ${constraint}\\s+CHECK\\s*\\(([\\s\\S]*?)\\);`, 'i'),
  );
  return match?.[1].replace(/\s+/g, ' ').trim() ?? '';
}

describe('0022_shipping_usage_return_driver migration', () => {
  it('guards execution as supabase_admin and wraps everything in one transaction', () => {
    expect(migrationSql).toMatch(/pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i);
    expect(migrationSql).toMatch(/SET\s+lock_timeout/i);
    expect(migrationSql).toMatch(/SET\s+statement_timeout/i);
    expect(migrationSql.match(/^\s*BEGIN;/gm)).toHaveLength(1);
    expect(migrationSql.match(/^\s*COMMIT;/gm)).toHaveLength(1);
    expect(migrationSql.search(/pg_has_role/i)).toBeLessThan(migrationSql.search(/ALTER TABLE/i));
  });

  it('adds a nullable free-text return_driver_name idempotently', () => {
    expect(migrationSql).toMatch(
      /ALTER TABLE public\.shipping_usage\s+ADD COLUMN IF NOT EXISTS return_driver_name text NULL;/i,
    );
    expect(migrationSql).not.toMatch(/return_driver_name text NOT NULL/i);
    expect(migrationSql).not.toMatch(/\bDEFAULT\b/i);
  });

  it('caps the name with the same check expression as driver_name (0017)', () => {
    const expected = checkExpression(delivery0017Sql, 'shipping_usage_driver_name_length');
    expect(expected).not.toBe('');
    expect(checkExpression(migrationSql, 'shipping_usage_return_driver_name_length')).toBe(
      expected.replace(/\bdriver_name\b/g, 'return_driver_name'),
    );
  });

  it('drops the constraint before re-adding it, so a partial apply can be replayed', () => {
    const drop = migrationSql.search(
      /DROP CONSTRAINT IF EXISTS shipping_usage_return_driver_name_length/i,
    );
    const add = migrationSql.search(/ADD CONSTRAINT shipping_usage_return_driver_name_length/i);
    expect(drop).toBeGreaterThan(-1);
    expect(add).toBeGreaterThan(drop);
  });

  it('documents that NULL means the delivery driver also does the return', () => {
    const comment = migrationSql.match(
      /COMMENT ON COLUMN public\.shipping_usage\.return_driver_name IS\s+'([^']*)'/i,
    );
    expect(comment?.[1]).toMatch(/NULL = the delivery driver also does the return/i);
  });

  it('grants nothing: the column inherits the service-role-only table grants', () => {
    expect(migrationSql).not.toMatch(/\bGRANT\b/i);
    expect(migrationSql).not.toMatch(/\bREVOKE\b/i);
  });

  it('never touches driver_name or other tables', () => {
    expect(migrationSql).not.toMatch(/[^_]driver_name_length/i);
    expect(migrationSql).not.toMatch(/ALTER TABLE public\.(?!shipping_usage\b)/i);
    expect(migrationSql).not.toMatch(/\b(UPDATE|DELETE\s+FROM|INSERT\s+INTO)\b/i);
  });

  describe('rollback', () => {
    it('guards execution as supabase_admin inside one transaction', () => {
      expect(rollbackSql).toMatch(/pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i);
      expect(rollbackSql.match(/^\s*BEGIN;/gm)).toHaveLength(1);
      expect(rollbackSql.match(/^\s*COMMIT;/gm)).toHaveLength(1);
    });

    it('drops the constraint, then the column, idempotently', () => {
      const constraint = rollbackSql.search(
        /DROP CONSTRAINT IF EXISTS shipping_usage_return_driver_name_length/i,
      );
      const column = rollbackSql.search(/DROP COLUMN IF EXISTS return_driver_name/i);
      expect(constraint).toBeGreaterThan(-1);
      expect(column).toBeGreaterThan(constraint);
    });

    it('never touches driver_name (0017)', () => {
      expect(rollbackSql).not.toMatch(/DROP COLUMN IF EXISTS driver_name/i);
      expect(rollbackSql).not.toMatch(/[^_]driver_name_length/i);
    });
  });
});
