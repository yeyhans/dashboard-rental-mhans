import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * T-026. Static assertions over `0006_t026_schema_gaps.sql`, the schema-gap migration that closes
 * the 4 Área 01 gaps documented in `openspec/changes/consolidado-web-2027/apply-progress.md`
 * ("Decisiones de schema pendientes"), all resolved as Opción A by the user on 2026-08-23:
 *
 *   1. Check-In        -> new table `asset_movements` (FK to `serialised_assets`)
 *   2. Conductor/Pago   -> nullable columns directly on `shipping_usage`
 *   3. Rentabilidad     -> `serialised_assets.acquisition_cost` + new table `expenses`
 *   4. Denominador      -> no new table; covered by `asset_movements` (numerator) +
 *                          `serialised_assets` (denominator, already exists since 0004)
 *
 * Vitest has no database: these are text assertions over the SQL. The runtime proof (grants,
 * RLS, hermes_ro isolation) is the staging rehearsal + the isolation script this migration must
 * ship, following the 0004 pattern exactly.
 *
 * POST-REVIEW FIXES (R1, 2026-08-23):
 *   R1-001 — `expenses.category` was free text with only a non-empty CHECK, deviating from the
 *   project's classification-field convention (`tipo_cliente`, `discount_type`, `shipping_type`,
 *   this migration's own `direction`). Fixed to an enum CHECK sourced from the canonical
 *   Rentabilidad HTML's `#g-cat` <select> (`Área 01 · Rental Técnico/OFF/
 *   MarioHans_OS_Area01_Rentabilidad_Canonical_RC2.1.2.html`), English tokens per the project's
 *   condition-vocabulary convention (0004): warehouse, internet, payroll, accounting, software,
 *   hosting, delivery, transport, maintenance, repair, supplies.
 *   R1-002 — `asset_movements.checked_by` was free text in a table that declares itself an audit
 *   trail, with no anchor to verifiable identity. Fixed to `checked_by_admin_id`, a nullable FK to
 *   `admin_users(id)` ON DELETE SET NULL — the dashboard's `withAuth` already resolves the acting
 *   admin from `admin_users`, so the audit trail anchors to the same identity the rest of the app
 *   uses, rather than an unverified typed name.
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

const migration = read('../0006_t026_schema_gaps.sql');
const rollback = read('../0006_t026_schema_gaps.down.sql');
const migrationSql = executableSql(migration);
const rollbackSql = executableSql(rollback);

describe('0006_t026_schema_gaps migration', () => {
  it('guards execution as supabase_admin, per prod-parity audit convention', () => {
    expect(migrationSql).toMatch(/pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i);
  });

  describe('gap 1 — asset_movements (Check-In)', () => {
    it('creates asset_movements tied to an existing asset and order', () => {
      expect(migration).toMatch(/CREATE TABLE (IF NOT EXISTS )?public\.asset_movements/i);
      expect(migrationSql).toMatch(
        /asset_id\s+bigint\s+NOT NULL\s+REFERENCES public\.serialised_assets\(id\)/i
      );
      expect(migrationSql).toMatch(/order_id\s+integer\s+NOT NULL\s+REFERENCES public\.orders\(id\)/i);
    });

    it('constrains direction to checkout/checkin', () => {
      expect(migrationSql).toMatch(
        /direction\s+text\s+NOT NULL\s+CHECK\s*\(\s*direction\s+IN\s*\(\s*'checkout'\s*,\s*'checkin'\s*\)\s*\)/i
      );
    });

    it('uses GENERATED ALWAYS AS IDENTITY, not serial, to avoid a separate sequence grant', () => {
      const assetMovementsBlock = migration.slice(migration.indexOf('CREATE TABLE'));
      expect(assetMovementsBlock).toMatch(/GENERATED ALWAYS AS IDENTITY/i);
      expect(migrationSql).not.toMatch(/\bserial\b/i);
    });

    it('anchors the audit trail to a verifiable admin identity, not free text (R1-002)', () => {
      expect(migrationSql).toMatch(
        /checked_by_admin_id\s+bigint\s+REFERENCES public\.admin_users\(id\)\s+ON DELETE SET NULL/i
      );
      expect(migrationSql).not.toMatch(/checked_by\s+text/i);
    });
  });

  describe('gap 2 — driver/delivery payment on shipping_usage', () => {
    it('adds nullable driver and delivery payment columns directly on shipping_usage', () => {
      expect(migrationSql).toMatch(
        /ALTER TABLE public\.shipping_usage[\s\S]*?ADD COLUMN IF NOT EXISTS driver_name text/i
      );
      expect(migrationSql).toMatch(/ADD COLUMN IF NOT EXISTS driver_phone text/i);
      expect(migrationSql).toMatch(
        /ADD COLUMN IF NOT EXISTS delivery_payment_status text/i
      );
      expect(migrationSql).toMatch(/ADD COLUMN IF NOT EXISTS delivery_payment_amount numeric/i);
    });

    it('constrains delivery_payment_status to unpaid/paid', () => {
      expect(migrationSql).toMatch(
        /delivery_payment_status[\s\S]*?CHECK\s*\([\s\S]*?IN\s*\(\s*'unpaid'\s*,\s*'paid'\s*\)/i
      );
    });

    it('does not create a new table for delivery — no delivery_assignments table', () => {
      expect(migrationSql).not.toMatch(/CREATE TABLE[^;]*delivery_assignments/i);
    });
  });

  describe('gap 3 — acquisition_cost + expenses (Rentabilidad, minimal scope)', () => {
    it('adds acquisition_cost to serialised_assets, non-negative', () => {
      expect(migrationSql).toMatch(
        /ALTER TABLE public\.serialised_assets[\s\S]*?ADD COLUMN IF NOT EXISTS acquisition_cost numeric/i
      );
      expect(migrationSql).toMatch(/acquisition_cost IS NULL OR acquisition_cost >= 0/i);
    });

    it('creates a minimal expenses table with nullable links to orders and assets', () => {
      expect(migration).toMatch(/CREATE TABLE (IF NOT EXISTS )?public\.expenses/i);
      expect(migrationSql).toMatch(/related_order_id\s+integer\s+REFERENCES public\.orders\(id\)/i);
      expect(migrationSql).toMatch(
        /related_asset_id\s+bigint\s+REFERENCES public\.serialised_assets\(id\)/i
      );
    });

    it('does not create recurring_expenses or a P&L view — Opción A scope only', () => {
      expect(migrationSql).not.toMatch(/recurring_expenses/i);
      expect(migrationSql).not.toMatch(/CREATE (MATERIALIZED )?VIEW[^;]*p_?&?l/i);
    });

    it('constrains category to the canonical Rentabilidad vocabulary, not free text (R1-001)', () => {
      const expectedCategories = [
        'warehouse',
        'internet',
        'payroll',
        'accounting',
        'software',
        'hosting',
        'delivery',
        'transport',
        'maintenance',
        'repair',
        'supplies',
      ];
      const categoryBlockMatch = migrationSql.match(/category\s+text\s+NOT NULL\s+CHECK\s*\(([\s\S]*?)\)/i);
      expect(categoryBlockMatch).not.toBeNull();
      const categoryCheck = categoryBlockMatch![1];
      expect(categoryCheck).toMatch(/category\s+IN\s*\(/i);
      for (const category of expectedCategories) {
        expect(categoryCheck).toMatch(new RegExp(`'${category}'`));
      }
      // No free-text-only guard (length(btrim(...)) > 0) left over from the pre-review version.
      expect(migrationSql).not.toMatch(/category[\s\S]{0,40}length\(btrim\(category\)\)/i);
    });
  });

  describe('gap 4 — denominator: no new table, reuses asset_movements + serialised_assets', () => {
    it('creates exactly two new tables in this migration: asset_movements and expenses', () => {
      const createTableMatches = migrationSql.match(
        /CREATE TABLE (IF NOT EXISTS )?public\.\w+/gi
      );
      expect(createTableMatches).toHaveLength(2);
    });
  });

  describe('privilege posture — new tables follow the 0004 isolation pattern', () => {
    it('grants hermes_ro nothing on the new tables (inventory + financial data, no MCP consumer)', () => {
      const grantsToHermesRo = /\bGRANT\b[^;]*\bhermes_ro\b/i;
      expect(migrationSql).not.toMatch(grantsToHermesRo);
      expect(rollbackSql).not.toMatch(grantsToHermesRo);
    });

    it('revokes the blanket anon/authenticated privileges on both new tables', () => {
      expect(migrationSql).toMatch(/REVOKE ALL ON TABLE public\.asset_movements FROM PUBLIC/i);
      expect(migrationSql).toMatch(
        /REVOKE ALL ON TABLE public\.asset_movements FROM anon, authenticated/i
      );
      expect(migrationSql).toMatch(/REVOKE ALL ON TABLE public\.expenses FROM PUBLIC/i);
      expect(migrationSql).toMatch(
        /REVOKE ALL ON TABLE public\.expenses FROM anon, authenticated/i
      );
    });

    it('enables RLS and admits only service_role on both new tables', () => {
      expect(migrationSql).toMatch(
        /ALTER TABLE public\.asset_movements ENABLE ROW LEVEL SECURITY/i
      );
      expect(migrationSql).toMatch(/ALTER TABLE public\.expenses ENABLE ROW LEVEL SECURITY/i);
      const policyMatches = migrationSql.match(/CREATE POLICY[^;]*TO service_role/gi);
      expect(policyMatches).not.toBeNull();
      expect((policyMatches ?? []).length).toBeGreaterThanOrEqual(2);
    });
  });

  it('ships a rollback that drops both new tables and the added columns', () => {
    expect(rollbackSql).toMatch(/DROP TABLE (IF EXISTS )?public\.asset_movements/i);
    expect(rollbackSql).toMatch(/DROP TABLE (IF EXISTS )?public\.expenses/i);
    expect(rollbackSql).toMatch(
      /ALTER TABLE public\.serialised_assets\s+DROP COLUMN IF EXISTS acquisition_cost/i
    );
    expect(rollbackSql).toMatch(
      /ALTER TABLE public\.shipping_usage[\s\S]*?DROP COLUMN IF EXISTS driver_name/i
    );
  });
});
