import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Static assertions over `0007_shipping_usage_order_fk.sql`, which adds the missing
 * `shipping_usage.order_id -> orders(id)` foreign key.
 *
 * WHY THE FK IS LOAD-BEARING, not cosmetic. `DeliveryService.getBoard`
 * (`src/services/deliveryService.ts:78-87`) reads the Delivery board with a single PostgREST
 * query that embeds `orders (...)` inside a `shipping_usage` select. PostgREST resolves an
 * embedded resource by looking up a foreign key between the two relations; with no FK on
 * `shipping_usage.order_id` there is no relationship to resolve, so the request fails and the
 * whole `/delivery` module renders empty. The FK is what makes that embed legal.
 *
 * ON DELETE RESTRICT, matching the reasoning 0006 wrote for `asset_movements`: a shipment record
 * is evidence that a physical delivery happened against an order. Deleting the order must not
 * silently erase it.
 *
 * Vitest has no database: these are text assertions over the SQL. The runtime proof (the FK
 * actually existing, and the embed resolving) is the staging rehearsal, following the 0004/0006
 * pattern.
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

const migration = read('../0007_shipping_usage_order_fk.sql');
const rollback = read('../0007_shipping_usage_order_fk.down.sql');
const migrationSql = executableSql(migration);
const rollbackSql = executableSql(rollback);

describe('0007_shipping_usage_order_fk migration', () => {
  it('guards execution as supabase_admin, per prod-parity audit convention', () => {
    expect(migrationSql).toMatch(/pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i);
  });

  it('wraps forward and rollback in a transaction, like the rest of the chain', () => {
    expect(migrationSql).toMatch(/^\s*BEGIN;/m);
    expect(migrationSql).toMatch(/^\s*COMMIT;/m);
    expect(rollbackSql).toMatch(/^\s*BEGIN;/m);
    expect(rollbackSql).toMatch(/^\s*COMMIT;/m);
  });

  describe('the foreign key itself', () => {
    it('adds the FK on shipping_usage.order_id referencing orders(id)', () => {
      expect(migrationSql).toMatch(
        /ALTER TABLE(\s+ONLY)?\s+public\.shipping_usage[\s\S]*?FOREIGN KEY\s*\(\s*order_id\s*\)\s*REFERENCES\s+public\.orders\s*\(\s*id\s*\)/i
      );
    });

    it('names the constraint shipping_usage_order_id_fkey', () => {
      expect(migrationSql).toMatch(
        /ADD CONSTRAINT\s+shipping_usage_order_id_fkey\s+FOREIGN KEY/i
      );
    });

    it('uses ON DELETE RESTRICT — a shipment record must not vanish with its order', () => {
      const fkBlock = migrationSql.slice(
        migrationSql.search(/ADD CONSTRAINT\s+shipping_usage_order_id_fkey/i)
      );
      expect(fkBlock).toMatch(/REFERENCES\s+public\.orders\s*\(\s*id\s*\)\s*ON DELETE RESTRICT/i);
      expect(fkBlock).not.toMatch(/ON DELETE\s+(CASCADE|SET NULL)/i);
    });

    it('is idempotent — a partial apply can be replayed without erroring', () => {
      // Postgres has no ADD CONSTRAINT IF NOT EXISTS, so the guard is a pg_constraint lookup.
      expect(migrationSql).toMatch(/pg_constraint/i);
      expect(migrationSql).toMatch(/shipping_usage_order_id_fkey/);
    });
  });

  describe('pre-flight safety for environments that already hold rows', () => {
    it('asserts no orphan order_id before adding the constraint', () => {
      // The consolidado table was empty at authoring time, but production may not be: the
      // migration must fail loudly on an orphan rather than half-apply.
      expect(migrationSql).toMatch(/RAISE EXCEPTION/i);
      expect(migrationSql).toMatch(
        /FROM\s+public\.shipping_usage[\s\S]*?order_id IS NOT NULL[\s\S]*?public\.orders/i
      );
    });
  });

  describe('scope — schema shape only, no privilege or RLS drift', () => {
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

    it('creates no table — this migration only constrains an existing one', () => {
      expect(migrationSql).not.toMatch(/CREATE TABLE/i);
    });
  });

  it('ships a rollback that drops exactly that constraint, idempotently', () => {
    expect(rollbackSql).toMatch(
      /ALTER TABLE(\s+ONLY)?\s+public\.shipping_usage\s+DROP CONSTRAINT IF EXISTS shipping_usage_order_id_fkey/i
    );
  });
});
