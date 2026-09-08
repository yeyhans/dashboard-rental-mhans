import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Static assertions over `0010_product_valuation.sql`, which gives `products` the three columns
 * behind the client's count spreadsheet: the quantity they declare owning and the market/used
 * value per unit, in CLP.
 *
 * Two things are deliberately NOT columns, and the tests pin both absences: "Numero serie" is
 * the model code (`products.sku`, already there), and "Valor Total" is derived in
 * `src/lib/productValuation.ts` from the counted (or declared) quantity times the used value — a
 * stored total would drift the moment a unit is counted or a value edited.
 *
 * Vitest has no database: these are text assertions over the SQL. The runtime proof is the
 * staging rehearsal, following the 0004–0009 pattern.
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

const migration = read('../0010_product_valuation.sql');
const rollback = read('../0010_product_valuation.down.sql');
const migrationSql = executableSql(migration);
const rollbackSql = executableSql(rollback);

const COLUMNS = ['declared_quantity', 'market_value_clp', 'used_value_clp'] as const;

describe('0010_product_valuation migration', () => {
  it('guards execution as supabase_admin, per prod-parity audit convention', () => {
    expect(migrationSql).toMatch(/pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i);
  });

  it('wraps forward and rollback in a transaction, like the rest of the chain', () => {
    expect(migrationSql).toMatch(/^\s*BEGIN;/m);
    expect(migrationSql).toMatch(/^\s*COMMIT;/m);
    expect(rollbackSql).toMatch(/^\s*BEGIN;/m);
    expect(rollbackSql).toMatch(/^\s*COMMIT;/m);
  });

  it('sets lock_timeout and statement_timeout — products is read by the storefront', () => {
    expect(migrationSql).toMatch(/SET\s+lock_timeout/i);
    expect(migrationSql).toMatch(/SET\s+statement_timeout/i);
  });

  describe('the columns', () => {
    for (const column of COLUMNS) {
      it(`adds ${column} to public.products as a nullable integer, idempotently`, () => {
        expect(migrationSql).toMatch(
          new RegExp(
            `ALTER TABLE(\\s+ONLY)?\\s+public\\.products[\\s\\S]*?ADD COLUMN IF NOT EXISTS\\s+${column}\\s+integer`,
            'i'
          )
        );
        expect(migrationSql).not.toMatch(new RegExp(`${column}\\s+integer[^;]*NOT NULL`, 'i'));
        expect(migrationSql).not.toMatch(new RegExp(`${column}\\s+integer[^;]*DEFAULT`, 'i'));
      });

      it(`bounds ${column} at >= 0 with a constraint named after it`, () => {
        expect(migrationSql).toMatch(new RegExp(`CONSTRAINT\\s+products_${column}_check`, 'i'));
        expect(migrationSql).toMatch(
          new RegExp(`CHECK\\s*\\(\\s*${column}\\s+IS\\s+NULL\\s+OR\\s+${column}\\s*>=\\s*0\\s*\\)`, 'i')
        );
      });
    }

    it('stores CLP as integer, never as numeric or float — pesos have no decimals', () => {
      expect(migrationSql).not.toMatch(/_clp\s+(numeric|real|double precision|float|money)/i);
    });

    it('guards the CHECKs with pg_constraint lookups so a partial apply can be replayed', () => {
      expect(migrationSql).toMatch(/pg_constraint/i);
    });
  });

  describe('what is deliberately absent', () => {
    it('adds no serial-number column — "Numero serie" is the existing products.sku', () => {
      expect(migrationSql).not.toMatch(/ADD COLUMN[^;]*serial/i);
    });

    it('stores no total — "Valor Total" is derived from quantity times used value', () => {
      expect(migrationSql).not.toMatch(/total_value/i);
    });
  });

  describe('scope — three columns, no privilege or RLS drift', () => {
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
      expect(migrationSql).not.toMatch(/DROP\s+(TABLE|COLUMN|INDEX)/i);
      expect(migrationSql).not.toMatch(/UPDATE\s+public\.products/i);
    });
  });

  describe('rollback', () => {
    for (const column of COLUMNS) {
      it(`drops ${column}, idempotently`, () => {
        expect(rollbackSql).toMatch(new RegExp(`DROP COLUMN IF EXISTS\\s+${column}`, 'i'));
      });
    }

    it('guards ownership the same way the forward migration does', () => {
      expect(rollbackSql).toMatch(/pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i);
    });

    it('touches nothing but those columns', () => {
      expect(rollbackSql).not.toMatch(/DROP TABLE/i);
      expect(rollbackSql).not.toMatch(/UPDATE\s+public\.products/i);
    });

    it('documents the data loss and the query that captures it', () => {
      expect(rollback).toMatch(/DATA LOSS/);
      expect(rollback).toMatch(/declared_quantity IS NOT NULL/);
    });
  });
});
