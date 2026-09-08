import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Static assertions over `0008_orders_reserve_config.sql`, which gives `orders` the two columns
 * the application has been writing to since before this migration existed.
 *
 * WHY THIS IS A REPAIR, NOT A FEATURE. The per-order reserve was already built end to end in the
 * dashboard: `ProcessOrder.tsx:83-84` and `PaymentsTable.tsx:408-409` read `order.reserve_type`
 * and `order.reserve_value`, both offer a percent/fixed toggle, both PUT the pair to
 * `/api/orders/update/[id]`, and that endpoint validates it (`[id].ts:117-128`, `percent|fixed`,
 * numeric, non-negative) and forwards it into the `orders` UPDATE. The columns were never added,
 * so every save fails at the database with `42703 column "reserve_type" of relation "orders" does
 * not exist`, and every read falls back to the hard-coded `'percent'` / `25`. The UI has been
 * offering a setting that could not be stored.
 *
 * The column names, the type vocabulary and the numeric contract are therefore NOT a fresh design
 * decision — they are dictated by the code already in the tree. Introducing a differently named
 * column (`reserve_percent`, say) would leave that whole path broken and add a second source of
 * truth for the same number, which is the defect this work exists to remove.
 *
 * DEFAULTS 'percent' / 25. Both call sites already fall back to exactly these when the field is
 * absent, and all 499 existing orders were quoted at 25% with their budget PDFs already in
 * customers' inboxes. Defaulting to anything else would reprice invoiced history.
 *
 * NOT NULL. Every read site treats the value as always-present via `||` / `??` fallbacks. A
 * nullable column would push a NULL branch into the dashboard, the PDF generators and the customer
 * portal independently — three places to drift apart again.
 *
 * Vitest has no database: these are text assertions over the SQL. The runtime proof is the
 * staging rehearsal, following the 0004/0006/0007 pattern.
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

const migration = read('../0008_orders_reserve_config.sql');
const rollback = read('../0008_orders_reserve_config.down.sql');
const migrationSql = executableSql(migration);
const rollbackSql = executableSql(rollback);

describe('0008_orders_reserve_config migration', () => {
  it('guards execution as supabase_admin, per prod-parity audit convention', () => {
    expect(migrationSql).toMatch(/pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i);
  });

  it('wraps forward and rollback in a transaction, like the rest of the chain', () => {
    expect(migrationSql).toMatch(/^\s*BEGIN;/m);
    expect(migrationSql).toMatch(/^\s*COMMIT;/m);
    expect(rollbackSql).toMatch(/^\s*BEGIN;/m);
    expect(rollbackSql).toMatch(/^\s*COMMIT;/m);
  });

  it('sets a lock_timeout — orders is written by live traffic', () => {
    expect(migrationSql).toMatch(/SET\s+lock_timeout/i);
  });

  describe('the columns the application already writes to', () => {
    it('adds reserve_type to public.orders', () => {
      expect(migrationSql).toMatch(
        /ALTER TABLE(\s+ONLY)?\s+public\.orders[\s\S]*?ADD COLUMN IF NOT EXISTS\s+reserve_type/i
      );
    });

    it('adds reserve_value to public.orders', () => {
      expect(migrationSql).toMatch(
        /ALTER TABLE(\s+ONLY)?\s+public\.orders[\s\S]*?ADD COLUMN IF NOT EXISTS\s+reserve_value/i
      );
    });

    it('stores the amount as numeric, not float — it multiplies money', () => {
      expect(migrationSql).toMatch(/reserve_value\s+numeric\s*\(/i);
      expect(migrationSql).not.toMatch(/reserve_value\s+(real|double precision|float)/i);
    });

    it('defaults to the exact fallbacks the UI already assumes: percent / 25', () => {
      expect(migrationSql).toMatch(/reserve_type[\s\S]*?DEFAULT\s+'percent'/i);
      expect(migrationSql).toMatch(/reserve_value[\s\S]*?DEFAULT\s+25/i);
    });

    it('makes both NOT NULL, so no surface has to invent a fallback', () => {
      expect(migrationSql).toMatch(/reserve_type[\s\S]*?NOT NULL/i);
      expect(migrationSql).toMatch(/reserve_value[\s\S]*?NOT NULL/i);
    });
  });

  describe('the bounds', () => {
    it('accepts exactly the vocabulary the endpoint validates: percent and fixed', () => {
      expect(migrationSql).toMatch(/reserve_type\s+IN\s*\(\s*'percent'\s*,\s*'fixed'\s*\)/i);
    });

    it('caps a percentage at 100 — a reserve cannot exceed the total', () => {
      expect(migrationSql).toMatch(/'percent'[\s\S]*?reserve_value\s*<=\s*100/i);
    });

    it('rejects a negative amount in either mode', () => {
      expect(migrationSql).toMatch(/reserve_value\s*>=\s*0/i);
    });

    it('names the constraints after their columns', () => {
      expect(migrationSql).toMatch(/CONSTRAINT\s+orders_reserve_type_check/i);
      expect(migrationSql).toMatch(/CONSTRAINT\s+orders_reserve_value_check/i);
    });

    it('is idempotent — a partial apply can be replayed without erroring', () => {
      expect(migrationSql).toMatch(/ADD COLUMN IF NOT EXISTS/i);
      expect(migrationSql).toMatch(/pg_constraint/i);
    });
  });

  describe('scope — two columns, no privilege or RLS drift', () => {
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

    it('creates no table and drops no column — it only widens orders', () => {
      expect(migrationSql).not.toMatch(/CREATE TABLE/i);
      expect(migrationSql).not.toMatch(/DROP COLUMN/i);
    });

    it('never reprices an existing order (no UPDATE of the new columns)', () => {
      // The DEFAULTs backfill existing rows at percent/25, which is what they were invoiced at.
      // An explicit UPDATE here would be indistinguishable from repricing sent orders.
      expect(migrationSql).not.toMatch(/UPDATE\s+public\.orders/i);
    });
  });

  describe('rollback', () => {
    it('drops exactly those two columns, idempotently', () => {
      expect(rollbackSql).toMatch(/DROP COLUMN IF EXISTS\s+reserve_type/i);
      expect(rollbackSql).toMatch(/DROP COLUMN IF EXISTS\s+reserve_value/i);
    });

    it('guards ownership the same way the forward migration does', () => {
      expect(rollbackSql).toMatch(/pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i);
    });

    it('touches nothing but those columns', () => {
      expect(rollbackSql).not.toMatch(/DROP TABLE/i);
      expect(rollbackSql).not.toMatch(/UPDATE\s+public\.orders/i);
    });
  });
});
