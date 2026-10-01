import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `ProfitabilityService.getBoard` — D-27 follow-up (R3-margin-series-service-untested): the
 * `marginSeries` derivation (`getMarginSeries`, D-24 08c) had no test of its own, including the
 * UNDEFINED_TABLE graceful-degrade path `getCosts` already covers. Mocks `supabaseAdmin`
 * end-to-end, same pattern as `expenseService.test.ts` / `serialisedAssetService.test.ts`.
 */

interface QueryResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

/**
 * Minimal PostgREST builder double, same shape as `serialisedAssetService.test.ts`'s: every
 * filter method returns the same builder so the service can chain freely (`.select().in().gte()
 * .limit()`, `.select().gte().lt()`, or just `.select().gte()`), and `then` makes the builder
 * itself awaitable from any point in the chain.
 */
function createQueryBuilder(result: QueryResult) {
  const chain = () => builder;
  const builder: Record<string, unknown> = {
    select: chain,
    eq: chain,
    in: chain,
    gte: chain,
    lt: chain,
    limit: chain,
    order: chain,
    then: (
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

const state = vi.hoisted(() => ({
  orders: { data: [] as any[], error: null as any },
  products: { data: [] as any[], error: null as any },
  expenses: { data: [] as any[], error: null as any },
  assets: { data: [] as any[], error: null as any },
}));

vi.mock("../../lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "orders") return createQueryBuilder(state.orders);
      if (table === "products") return createQueryBuilder(state.products);
      if (table === "expenses") return createQueryBuilder(state.expenses);
      if (table === "serialised_assets")
        return createQueryBuilder(state.assets);
      throw new Error(`unexpected table: ${table}`);
    },
  },
}));

const { ProfitabilityService } = await import("../profitabilityService");

const NOW = new Date("2026-09-15T12:00:00.000Z");

beforeEach(() => {
  state.orders = { data: [], error: null };
  state.products = { data: [], error: null };
  state.expenses = { data: [], error: null };
  state.assets = { data: [], error: null };
});

describe("ProfitabilityService.getBoard — marginSeries (D-24 08c / D-27)", () => {
  it("degrades marginSeries (and costs) to null when `expenses` does not exist yet (UNDEFINED_TABLE)", async () => {
    state.expenses = {
      data: null,
      error: { code: "42P01", message: 'relation "expenses" does not exist' },
    };

    const board = await ProfitabilityService.getBoard(NOW);

    expect(board.marginSeries).toBeNull();
    // `getCosts` guards against the same table/error, so the current-month costs degrade too —
    // this is the same migration-not-applied condition, not two independent failures.
    expect(board.costs).toBeNull();
  });

  it("rethrows an unexpected (non-UNDEFINED_TABLE) error instead of silently degrading", async () => {
    state.expenses = { data: null, error: { code: "500", message: "boom" } };

    await expect(ProfitabilityService.getBoard(NOW)).rejects.toMatchObject({
      code: "500",
    });
  });

  it("computes a real monthly margin series from the loaded expense rows once `expenses` exists", async () => {
    state.orders = {
      data: [
        {
          status: "completed",
          calculated_total: 100000,
          num_jornadas: 2,
          date_created: "2026-09-05T00:00:00.000Z",
          line_items: [],
        },
      ],
      error: null,
    };
    state.expenses = {
      data: [
        { category: "delivery", amount: 10000, expense_date: "2026-09-01" }, // VARIABLE → Costos Directos
        { category: "warehouse", amount: 5000, expense_date: "2026-09-01" }, // FIXED → Gastos Operacionales
      ],
      error: null,
    };

    const board = await ProfitabilityService.getBoard(NOW);

    expect(board.marginSeries).not.toBeNull();
    expect(board.marginSeries).toHaveLength(12); // same 12-month window as `series`

    const september = board.marginSeries!.find((m) => m.month === "2026-09");
    expect(september).toBeDefined();
    expect(september!.ingresos).toBe(100000);
    expect(september!.costosDirectos).toBe(10000);
    expect(september!.gastosOperacionales).toBe(5000);
    expect(september!.utilidadOperacional).toBe(100000 - 10000 - 5000);

    // A month with no recorded orders/expenses stays zero, not absent — same convention as
    // `monthlyRevenueSeries` (see `lib/profitability.ts`'s header).
    const may = board.marginSeries!.find((m) => m.month === "2026-05");
    expect(may).toEqual({
      month: "2026-05",
      ingresos: 0,
      costosDirectos: 0,
      gastosOperacionales: 0,
      utilidadOperacional: 0,
      margenBrutoPercentage: null,
      margenOperacionalPercentage: null,
    });
  });
});
