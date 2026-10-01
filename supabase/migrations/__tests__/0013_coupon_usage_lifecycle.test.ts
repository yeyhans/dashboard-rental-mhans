import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Static assertions over `0013_coupon_usage_lifecycle.sql`, the pair of functions that record and
 * release an order's coupon usage.
 *
 * The row lock is the whole point of the forward function, so it is asserted token by token:
 * without `SELECT ... FOR UPDATE` on the coupon, two orders created at the same instant both read
 * `usage_count = 0` and a one-use coupon is spent twice. The existing `apply_coupon` cannot be
 * reused for this — it inserts and increments without ever looking at `usage_limit`.
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

const migrationSql = executableSql(read('../0013_coupon_usage_lifecycle.sql'));
const rollbackSql = executableSql(read('../0013_coupon_usage_lifecycle.down.sql'));

describe('0013_coupon_usage_lifecycle migration', () => {
  it('guards execution as supabase_admin and wraps everything in a transaction', () => {
    expect(migrationSql).toMatch(/pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i);
    expect(migrationSql).toMatch(/^\s*BEGIN;/m);
    expect(migrationSql).toMatch(/^\s*COMMIT;/m);
    expect(migrationSql).toMatch(/SET\s+lock_timeout/i);
    expect(migrationSql).toMatch(/SET\s+statement_timeout/i);
  });

  it('creates both functions idempotently', () => {
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION\s+public\.record_coupon_usage_for_order/i
    );
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION\s+public\.release_coupon_usage_for_order/i
    );
  });

  describe('record_coupon_usage_for_order', () => {
    const body =
      migrationSql.match(
        /CREATE OR REPLACE FUNCTION\s+public\.record_coupon_usage_for_order([\s\S]*?)\$record\$;/i
      )?.[1] ?? '';

    it('was actually found in the file', () => {
      expect(body.length).toBeGreaterThan(0);
    });

    it('locks the coupon row before deciding, so concurrent orders serialise', () => {
      expect(body).toMatch(/FROM\s+public\.coupons\s+WHERE\s+code\s*=\s*p_coupon_code\s+FOR UPDATE/i);
    });

    it('enforces usage_limit — the check apply_coupon never had', () => {
      expect(body).toMatch(/v_coupon\.usage_limit\s+IS NOT NULL/i);
      expect(body).toMatch(/v_total_uses\s*>=\s*v_coupon\.usage_limit/i);
      expect(body).toMatch(/alcanzado su l[ií]mite de uso/i);
    });

    it('enforces usage_limit_per_user', () => {
      expect(body).toMatch(/v_coupon\.usage_limit_per_user\s+IS NOT NULL/i);
      expect(body).toMatch(/v_user_uses\s*>=\s*v_coupon\.usage_limit_per_user/i);
    });

    it('refuses a coupon that is not published', () => {
      expect(body).toMatch(/v_coupon\.status\s*(<>|!=)\s*'publish'/i);
    });

    it('drops whatever the order had recorded before, so a swap leaves one row', () => {
      expect(body).toMatch(/release_coupon_usage_for_order\(p_order_id\)/i);
    });

    it('inserts the usage and increments the counter together', () => {
      expect(body).toMatch(/INSERT INTO public\.coupon_usage/i);
      expect(body).toMatch(/UPDATE public\.coupons[\s\S]*usage_count\s*=\s*COALESCE\(usage_count,\s*0\)\s*\+\s*1/i);
    });

    it('reports an already recorded usage as success, so a retry is a no-op', () => {
      expect(body).toMatch(/ya estaba registrado/i);
    });

    it('returns a refusal instead of raising on a duplicate', () => {
      expect(body).toMatch(/EXCEPTION WHEN unique_violation/i);
    });

    it('pins search_path, as a SECURITY DEFINER function must', () => {
      expect(body).toMatch(/SECURITY DEFINER/i);
      expect(body).toMatch(/SET search_path\s*=\s*public,\s*pg_temp/i);
    });
  });

  describe('release_coupon_usage_for_order', () => {
    const body =
      migrationSql.match(
        /CREATE OR REPLACE FUNCTION\s+public\.release_coupon_usage_for_order([\s\S]*?)\$release\$;/i
      )?.[1] ?? '';

    it('was actually found in the file', () => {
      expect(body.length).toBeGreaterThan(0);
    });

    it('deletes only this order rows', () => {
      expect(body).toMatch(/DELETE FROM public\.coupon_usage\s+WHERE order_id\s*=\s*p_order_id/i);
    });

    it('decrements the counter without ever going negative', () => {
      expect(body).toMatch(/GREATEST\(\s*COALESCE\(c\.usage_count,\s*0\)\s*-\s*pc\.uses,\s*0\s*\)/i);
    });

    it('is idempotent: a second release finds nothing and reports zero', () => {
      expect(body).toMatch(/COALESCE\(sum\(uses\),\s*0\)/i);
    });

    it('pins search_path, as a SECURITY DEFINER function must', () => {
      expect(body).toMatch(/SECURITY DEFINER/i);
      expect(body).toMatch(/SET search_path\s*=\s*public,\s*pg_temp/i);
    });
  });

  describe('privileges — service_role executes, nobody else', () => {
    it('revokes EXECUTE from PUBLIC, anon and authenticated on both functions', () => {
      for (const fn of ['record_coupon_usage_for_order', 'release_coupon_usage_for_order']) {
        expect(migrationSql).toMatch(
          new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\) FROM PUBLIC`, 'i')
        );
        expect(migrationSql).toMatch(
          new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\) FROM anon, authenticated`, 'i')
        );
        expect(migrationSql).toMatch(
          new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) TO service_role`, 'i')
        );
      }
    });

    it('grants hermes_ro nothing (isolation invariant of the chain)', () => {
      const grantsToHermesRo = /\bGRANT\b[^;]*\bhermes_ro\b/i;
      expect(migrationSql).not.toMatch(grantsToHermesRo);
      expect(rollbackSql).not.toMatch(grantsToHermesRo);
    });
  });

  it('creates no table and alters no existing relation', () => {
    expect(migrationSql).not.toMatch(/CREATE\s+TABLE/i);
    expect(migrationSql).not.toMatch(/ALTER\s+TABLE/i);
    expect(migrationSql).not.toMatch(/DROP\s+TABLE/i);
  });

  it('leaves the legacy apply_coupon function untouched', () => {
    expect(migrationSql).not.toMatch(/FUNCTION\s+public\.apply_coupon/i);
  });

  describe('rollback', () => {
    it('drops both functions idempotently, under the same role guard', () => {
      expect(rollbackSql).toMatch(
        /DROP FUNCTION IF EXISTS\s+public\.record_coupon_usage_for_order/i
      );
      expect(rollbackSql).toMatch(
        /DROP FUNCTION IF EXISTS\s+public\.release_coupon_usage_for_order/i
      );
      expect(rollbackSql).toMatch(/pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i);
    });

    it('destroys no recorded usage', () => {
      expect(rollbackSql).not.toMatch(/DELETE\s+FROM/i);
      expect(rollbackSql).not.toMatch(/TRUNCATE/i);
      expect(rollbackSql).not.toMatch(/DROP TABLE/i);
    });
  });
});
