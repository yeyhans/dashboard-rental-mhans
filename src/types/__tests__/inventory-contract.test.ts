import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Contract test for the per-unit valuation fields (migration 0023).
 *
 * Everything here is a static assertion: Vitest has no database and TypeScript interfaces do
 * not fail at runtime, so the only way to keep the contract honest is to read the source and
 * compare it with what the SQL actually declares.
 *
 * Three things are asserted:
 *
 *   1. The dashboard contract (`src/types/inventory.ts`) declares `acquisition_cost`,
 *      `purchase_date` and `market_price` on `InventoryUnit`, in that order.
 *   2. The ops copy of the shared block (`mariohans-3d-ops/src/domain/inventory.ts`) declares the
 *      same three fields with the same text. The ops file is a verbatim copy of the dashboard's
 *      shared block, so a divergence here is a divergence in production code — and it is the
 *      failure mode this whole repository already paid for once.
 *   3. Migration 0023 adds the two missing columns and binds `market_price` to `>= 0`.
 *
 * The ops half is skipped when the ops checkout is not next to the dashboard (a clone of
 * `dashboard/` alone, or the ops Docker build). That mirrors `tests/inventory/contractSync.test.ts`
 * in the ops repo, which skips the reverse direction for the same reason.
 */

const DASHBOARD_CONTRACT = "../inventory.ts";
const OPS_CONTRACT_URL = new URL(
  "../../../../mariohans-3d-ops/src/domain/inventory.ts",
  import.meta.url,
);
const MIGRATION = "../../../supabase/migrations/0023_unit_valuation.sql";
const ROLLBACK = "../../../supabase/migrations/0023_unit_valuation.down.sql";

/**
 * The three valuation fields, with the exact doc comment and declaration each file must carry.
 * The text is part of the contract: it is copied verbatim into the ops app.
 */
const VALUATION_FIELDS = [
  {
    name: "acquisition_cost",
    doc: "/** Costo de adquisición de esta unidad, en CLP. */",
    declaration: "acquisition_cost: number | null;",
  },
  {
    name: "purchase_date",
    doc: "/** Fecha de compra de la unidad (ISO 8601). */",
    declaration: "purchase_date: string | null;",
  },
  {
    name: "market_price",
    doc: "/** Precio de mercado de la unidad, en CLP. Semilla desde products.market_value_clp. */",
    declaration: "market_price: number | null;",
  },
] as const;

function read(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

/**
 * The two repositories do not agree on line endings (the dashboard checkout is CRLF, the ops one
 * is LF). The contract is about content, so the comparison normalises them first.
 */
function normalize(source: string): string {
  return source.replace(/\r\n/g, "\n");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The doc comment and the field declaration, adjacent and in this order. */
function fieldPattern(field: (typeof VALUATION_FIELDS)[number]): RegExp {
  return new RegExp(
    escapeRegExp(field.doc) + "\\s*\\n\\s*" + escapeRegExp(field.declaration),
  );
}

/** The `InventoryUnit` interface, verbatim, as written in the source. */
function inventoryUnitBlock(source: string): string {
  return (
    normalize(source).match(
      /export interface InventoryUnit \{[\s\S]*?\n\}/,
    )?.[0] ?? ""
  );
}

/**
 * The shared contract block, from the BEGIN marker to the END marker. This is the region the ops
 * app copies verbatim, so it is the region that must not drift.
 */
function sharedBlock(source: string): string {
  const lines = normalize(source).split("\n");
  const begin = lines.findIndex((line) =>
    line.includes("BEGIN SHARED INVENTORY CONTRACT"),
  );
  const end = lines.findIndex((line) =>
    line.includes("END SHARED INVENTORY CONTRACT"),
  );
  if (begin < 0 || end < 0)
    throw new Error("shared contract markers not found");
  return lines.slice(begin - 1, end + 2).join("\n");
}

/** The SQL with `--` line comments stripped, so assertions read code and not prose. */
function executableSql(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

describe("InventoryUnit valuation contract", () => {
  it("declares acquisition_cost, purchase_date and market_price", () => {
    const block = inventoryUnitBlock(read(DASHBOARD_CONTRACT));
    expect(block).not.toBe("");
    for (const field of VALUATION_FIELDS) {
      expect(block, `missing ${field.name}`).toMatch(fieldPattern(field));
    }
  });

  it("keeps the three valuation fields in a stable order", () => {
    const block = inventoryUnitBlock(read(DASHBOARD_CONTRACT));
    const positions = VALUATION_FIELDS.map((field) =>
      block.indexOf(field.declaration),
    );
    for (const position of positions) {
      expect(position).toBeGreaterThan(-1);
    }
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});

describe.skipIf(!existsSync(fileURLToPath(OPS_CONTRACT_URL)))(
  "ops copy of the shared inventory contract",
  () => {
    it("declares the same three valuation fields with the same text", () => {
      const block = inventoryUnitBlock(
        readFileSync(fileURLToPath(OPS_CONTRACT_URL), "utf8"),
      );
      expect(block).not.toBe("");
      for (const field of VALUATION_FIELDS) {
        expect(block, `missing ${field.name}`).toMatch(fieldPattern(field));
      }
    });

    it("matches the dashboard InventoryUnit block verbatim", () => {
      const ops = inventoryUnitBlock(
        readFileSync(fileURLToPath(OPS_CONTRACT_URL), "utf8"),
      );
      expect(ops).toBe(inventoryUnitBlock(read(DASHBOARD_CONTRACT)));
    });

    it("keeps the whole shared contract block identical", () => {
      const ops = sharedBlock(
        readFileSync(fileURLToPath(OPS_CONTRACT_URL), "utf8"),
      );
      expect(ops).toBe(sharedBlock(read(DASHBOARD_CONTRACT)));
    });
  },
);

describe("0023_unit_valuation migration", () => {
  it("runs under the role guard, in one transaction, with a lock timeout", () => {
    const sql = executableSql(read(MIGRATION));
    expect(sql).toMatch(
      /pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i,
    );
    expect(sql).toMatch(/^\s*BEGIN;/m);
    expect(sql).toMatch(/^\s*COMMIT;/m);
    expect(sql).toMatch(/SET\s+lock_timeout/i);
    expect(sql).toMatch(/SET\s+statement_timeout/i);
    expect(sql.match(/^\s*BEGIN;/gm)).toHaveLength(1);
    expect(sql.match(/^\s*COMMIT;/gm)).toHaveLength(1);
  });

  it("adds purchase_date and market_price to serialised_assets", () => {
    const sql = executableSql(read(MIGRATION));
    expect(sql).toMatch(
      /ALTER TABLE public\.serialised_assets\s+ADD COLUMN IF NOT EXISTS purchase_date date/i,
    );
    expect(sql).toMatch(
      /ALTER TABLE public\.serialised_assets\s+ADD COLUMN IF NOT EXISTS market_price numeric\(\d+,\s*\d+\)/i,
    );
  });

  it("gives market_price a precision that can hold a CLP amount", () => {
    const sql = executableSql(read(MIGRATION));
    const match = sql.match(/market_price numeric\((\d+),\s*(\d+)\)/i);
    expect(match).not.toBeNull();
    const [, precision, scale] = match as RegExpMatchArray;
    // numeric(5,2) tops out at 999.99 CLP. The catalogue is nowhere near that: a Profoto B10 is
    // 900.000 CLP and a Canon R5 4.000.000 CLP (src/services/__tests__/serialisedAssetService.test.ts).
    expect(Number(precision) - Number(scale)).toBeGreaterThanOrEqual(6);
  });

  it("bounds market_price to non-negative values with a named, idempotent constraint", () => {
    const sql = executableSql(read(MIGRATION));
    const drop = sql.search(
      /DROP CONSTRAINT IF EXISTS serialised_assets_market_price_check/i,
    );
    const add = sql.search(
      /ADD CONSTRAINT serialised_assets_market_price_check/i,
    );
    expect(drop).toBeGreaterThan(-1);
    expect(add).toBeGreaterThan(drop);
    expect(sql.slice(add, sql.indexOf(";", add))).toMatch(
      /CHECK \(market_price IS NULL OR market_price >= 0\)/i,
    );
  });

  it("never validates the purchase date in the database", () => {
    const sql = executableSql(read(MIGRATION));
    // A CHECK constraint must be immutable: Postgres rejects CURRENT_DATE (and now()) in one.
    // "The purchase date is not in the future" is a Service rule, not a database rule.
    expect(sql).not.toMatch(/CHECK[^;]*CURRENT_DATE/i);
    expect(sql).not.toMatch(/CHECK[^;]*now\(\)/i);
  });

  it("seeds market_price from the model value without overwriting an edited unit", () => {
    const sql = executableSql(read(MIGRATION));
    expect(sql).toMatch(/UPDATE public\.serialised_assets/i);
    expect(sql).toMatch(/SET market_price = p\.market_value_clp/i);
    expect(sql).toMatch(/FROM public\.products p/i);
    expect(sql).toMatch(/p\.id = sa\.product_id/i);
    expect(sql).toMatch(/sa\.market_price IS NULL/i);
    expect(sql).toMatch(/p\.market_value_clp IS NOT NULL/i);
  });

  it("comments the three valuation columns", () => {
    const sql = executableSql(read(MIGRATION));
    for (const column of [
      "purchase_date",
      "market_price",
      "acquisition_cost",
    ]) {
      expect(sql).toMatch(
        new RegExp(
          `COMMENT ON COLUMN public\\.serialised_assets\\.${column} IS`,
          "i",
        ),
      );
    }
  });

  it("adds no privilege of its own", () => {
    const sql = executableSql(read(MIGRATION));
    // A new column inherits the table's grants: service_role only, since 0004. hermes_ro gains
    // nothing, and the isolation invariant of the chain must stay intact.
    expect(sql).not.toMatch(/\bGRANT\b/i);
    expect(sql).not.toMatch(/\bREVOKE\b/i);
    expect(sql).not.toMatch(/hermes_/i);
  });

  it("asserts its own end state before COMMIT", () => {
    const sql = executableSql(read(MIGRATION));
    const assertAt = sql.search(/DO \$assert_0023\$/);
    expect(assertAt).toBeGreaterThan(-1);
    expect(assertAt).toBeLessThan(sql.search(/^\s*COMMIT;/m));
  });
});

describe("0023_unit_valuation rollback", () => {
  it("drops the two new columns and the constraint", () => {
    const sql = executableSql(read(ROLLBACK));
    expect(sql).toMatch(
      /DROP CONSTRAINT IF EXISTS serialised_assets_market_price_check/i,
    );
    expect(sql).toMatch(/DROP COLUMN IF EXISTS purchase_date/i);
    expect(sql).toMatch(/DROP COLUMN IF EXISTS market_price/i);
  });

  it("keeps acquisition_cost: that column is older than 0023", () => {
    const sql = executableSql(read(ROLLBACK));
    expect(sql).not.toMatch(/DROP COLUMN IF EXISTS acquisition_cost/i);
  });

  it("runs under the role guard, in one transaction", () => {
    const sql = executableSql(read(ROLLBACK));
    expect(sql).toMatch(
      /pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i,
    );
    expect(sql).toMatch(/^\s*BEGIN;/m);
    expect(sql).toMatch(/^\s*COMMIT;/m);
  });
});
