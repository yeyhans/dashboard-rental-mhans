import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * R-03a: Finanzas & Cobranza reads the best payment date available and writes the Pago select,
 * OC and Factura of one order.
 */
const state = vi.hoisted(() => ({
  selectColumns: "",
  rows: [] as unknown[],
  updatePayloads: [] as unknown[],
  updateFilters: [] as unknown[][],
  updateResult: { data: null, error: null } as {
    data: unknown;
    error: unknown;
  },
  // R-03b: the chart query, paged with `range`.
  gteArgs: [] as unknown[][],
  ranges: [] as number[][],
  pages: [] as unknown[][],
  boardRanges: [] as number[][],
  boardPages: [] as unknown[][],
}));

vi.mock("../../lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "orders") throw new Error(`unexpected ${table}`);
      return {
        select: (columns: string) => {
          state.selectColumns = columns;
          return {
            in: () => {
              const chain = {
                order: () => chain,
                limit: async () => ({ data: state.rows, error: null }),
                // D1-a: the board pages with `range` instead of one capped `limit`.
                range: async (from: number, to: number) => {
                  state.boardRanges.push([from, to]);
                  const page = state.boardPages.length
                    ? (state.boardPages[state.boardRanges.length - 1] ?? [])
                    : state.rows.slice(from, to + 1);
                  return { data: page, error: null };
                },
              };
              return chain;
            },
            gte: (...args: unknown[]) => {
              state.gteArgs.push(args);
              return {
                order: () => ({
                  range: async (from: number, to: number) => {
                    state.ranges.push([from, to]);
                    return {
                      data: state.pages[state.ranges.length - 1] ?? [],
                      error: null,
                    };
                  },
                }),
              };
            },
          };
        },
        update: (payload: unknown) => {
          state.updatePayloads.push(payload);
          return {
            eq: (...filter: unknown[]) => {
              state.updateFilters.push(filter);
              return {
                select: () => ({
                  maybeSingle: async () => state.updateResult,
                }),
              };
            },
          };
        },
      };
    },
  },
}));

const { FinanceService } = await import("../financeService");

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    order_key: "#0007",
    status: "completed",
    order_proyecto: "Campaña",
    order_fecha_termino: "2026-09-10",
    date_paid: null,
    date_completed: null,
    calculated_total: "100000.00",
    pago_reserva: true,
    pago_completo: true,
    reserve_type: null,
    reserve_value: null,
    orden_compra: null,
    numero_factura: null,
    billing_first_name: "Ana",
    billing_last_name: "Pérez",
    billing_company: null,
    ...overrides,
  };
}

beforeEach(() => {
  state.rows = [];
  state.boardRanges = [];
  state.boardPages = [];
  state.updatePayloads = [];
  state.updateFilters = [];
  state.updateResult = { data: null, error: null };
});

describe("FinanceService.getBoard — payment date", () => {
  it("reads date_completed so paid orders without date_paid still show a date", async () => {
    state.rows = [
      order({ id: 1, date_completed: "2026-09-11T12:00:00Z" }),
      order({ id: 2, date_paid: "2026-09-12T12:00:00Z" }),
      order({ id: 3 }),
    ];

    const board = await FinanceService.getBoard(
      new Date("2026-10-13T12:00:00Z"),
    );

    expect(state.selectColumns).toContain("date_completed");
    const byId = new Map(board.paidRows.map((r) => [r.id, r]));
    expect(byId.get(1)).toMatchObject({
      paidAt: "2026-09-11T12:00:00Z",
      paidAtSource: "date_completed",
    });
    expect(byId.get(2)).toMatchObject({
      paidAt: "2026-09-12T12:00:00Z",
      paidAtSource: "date_paid",
    });
    expect(byId.get(3)).toMatchObject({ paidAt: null, paidAtSource: null });
  });
});

describe("FinanceService.getBoard — every order, not the first 500 (D1-a)", () => {
  it("pages past the row cap so the newest orders are not dropped", async () => {
    const fullPage = Array.from({ length: 1000 }, (_, i) =>
      order({ id: i + 1, order_fecha_termino: "2026-01-10" }),
    );
    const newest = order({
      id: 1001,
      order_fecha_termino: "2026-10-12",
      pago_completo: false,
    });
    state.boardPages = [fullPage, [newest]];

    const board = await FinanceService.getBoard(
      new Date("2026-10-13T12:00:00Z"),
    );

    expect(state.boardRanges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(board.pendingRows.map((r) => r.id)).toContain(1001);
    expect(board.paidRows).toHaveLength(1000);
  });
});

describe("FinanceService.updatePayment", () => {
  const now = new Date("2026-10-13T15:00:00.000Z");

  it("writes the paid columns for that order only and returns the saved state", async () => {
    state.updateResult = {
      data: {
        id: 7,
        pago_completo: true,
        pago_reserva: true,
        date_paid: "2026-10-13T15:00:00.000Z",
        orden_compra: null,
        numero_factura: null,
      },
      error: null,
    };

    const saved = await FinanceService.updatePayment(7, { paid: true }, now);

    expect(state.updatePayloads).toEqual([
      {
        pago_completo: true,
        pago_reserva: true,
        date_paid: "2026-10-13T15:00:00.000Z",
      },
    ]);
    expect(state.updateFilters).toEqual([["id", 7]]);
    expect(saved).toEqual({
      id: 7,
      fullyPaid: true,
      reservePaid: true,
      paidAt: "2026-10-13T15:00:00.000Z",
      purchaseOrder: null,
      invoiceNumber: null,
    });
  });

  it("returns null when the order does not exist", async () => {
    state.updateResult = { data: null, error: null };
    await expect(
      FinanceService.updatePayment(999, { invoiceNumber: "F-1" }, now),
    ).resolves.toBeNull();
  });

  it("throws the database error", async () => {
    state.updateResult = { data: null, error: { message: "boom" } };
    await expect(
      FinanceService.updatePayment(7, { paid: false }, now),
    ).rejects.toEqual({ message: "boom" });
  });
});

describe("FinanceService.getCharts (R-03b)", () => {
  beforeEach(() => {
    state.gteArgs = [];
    state.ranges = [];
    state.pages = [];
  });

  it("aggregates server-side over a dated window, paging past the row cap", async () => {
    const chartRow = (id: number, overrides: Record<string, unknown> = {}) => ({
      ...order({ id, date_created: "2026-10-05T12:00:00Z" }),
      user_profiles: { tipo_cliente: "empresa" },
      ...overrides,
    });
    const fullPage = Array.from({ length: 1000 }, (_, i) => chartRow(i + 1));
    state.pages = [fullPage, [chartRow(1001, { status: "cancelled" })]];

    const charts = await FinanceService.getCharts(
      new Date("2026-10-13T15:00:00.000Z"),
    );

    // The window starts before the first month so the business-zone bucketing can trim it.
    expect(state.gteArgs[0]![0]).toBe("date_created");
    expect(String(state.gteArgs[0]![1]) < "2025-11-01").toBe(true);
    expect(state.selectColumns).toContain("user_profiles(tipo_cliente)");
    expect(state.ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(charts.months.at(-1)).toMatchObject({
      month: "2026-10",
      pedidos: 1000,
      ingresos: 100000000,
    });
    expect(charts.composition).toEqual([
      { key: "empresa", label: "Empresa", value: 100000000, share: 100 },
    ]);
  });
});
