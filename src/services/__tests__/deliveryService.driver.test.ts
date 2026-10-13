import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * R-06: `shipping_usage.driver_name` (migration 0017). The board must keep working before the
 * migration is applied, so it selects `*` instead of naming the column, and the write reports a
 * clear "pending migration" error instead of a 500.
 */
const latestCalls = vi.hoisted(() => [] as unknown[][]);

const state = vi.hoisted(() => ({
  usageSelect: "" as string,
  usageRows: [] as unknown[],
  updateResult: { data: [{ id: 3, driver_name: "Juan P." }], error: null } as {
    data: unknown;
    error: unknown;
  },
  updatePayloads: [] as unknown[],
  updateFilters: [] as unknown[][],
  driverRows: [] as unknown[],
}));

vi.mock("../../lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "shipping_methods") {
        return {
          select: () => ({ order: async () => ({ data: [], error: null }) }),
        };
      }
      if (table !== "shipping_usage") throw new Error(`unexpected ${table}`);
      return {
        select: (columns: string) => {
          state.usageSelect = columns;
          return {
            order: () => ({
              limit: async () => ({ data: state.usageRows, error: null }),
            }),
            // H-2: latest shipment of the order, deterministically.
            eq: () => {
              const chain: any = {
                order: (...args: unknown[]) => {
                  latestCalls.push(["order", ...args]);
                  return chain;
                },
                limit: (...args: unknown[]) => {
                  latestCalls.push(["limit", ...args]);
                  return chain;
                },
                maybeSingle: async () => ({
                  data: state.driverRows[0] ?? null,
                  error: null,
                }),
              };
              return chain;
            },
            not: () => ({
              order: () => ({
                limit: async () => ({ data: state.driverRows, error: null }),
              }),
            }),
          };
        },
        update: (payload: unknown) => {
          state.updatePayloads.push(payload);
          return {
            eq: (...filter: unknown[]) => {
              state.updateFilters.push(filter);
              return { select: async () => state.updateResult };
            },
          };
        },
      };
    },
  },
}));

const { DeliveryService } = await import("../deliveryService");
const { DRIVER_ERRORS } = await import("../../lib/delivery");

describe("DeliveryService driver", () => {
  afterEach(() => {
    state.usageRows = [];
    state.updatePayloads = [];
    state.updateFilters = [];
    state.driverRows = [];
    state.updateResult = {
      data: [{ id: 3, driver_name: "Juan P." }],
      error: null,
    };
  });

  it("reads shipping_usage with * so a missing driver_name column cannot break the board", async () => {
    state.usageRows = [
      {
        id: 3,
        order_id: 9,
        shipping_method_id: 1,
        shipping_cost: 15000,
        status: "pending",
        driver_name: "Juan P.",
        orders: {},
        shipping_methods: { name: "Estándar" },
      },
      {
        id: 4,
        order_id: 10,
        status: "pending",
        orders: {},
        shipping_methods: null,
      },
    ];

    const board = await DeliveryService.getBoard(
      new Date("2026-10-13T12:00:00Z"),
    );

    expect(state.usageSelect.startsWith("*,")).toBe(true);
    expect(board.history.map((row) => row.driverName)).toEqual([
      "Juan P.",
      null,
    ]);
  });

  it("stores the trimmed driver on the order's shipment", async () => {
    const result = await DeliveryService.setDriverForOrder(9, "  Juan P. ");

    expect(state.updatePayloads).toEqual([{ driver_name: "Juan P." }]);
    expect(state.updateFilters).toEqual([["order_id", 9]]);
    expect(result).toEqual({ shipmentId: 3, driverName: "Juan P." });
  });

  it("rejects an invalid name before writing", async () => {
    await expect(
      DeliveryService.setDriverForOrder(9, "x".repeat(81)),
    ).rejects.toThrow(DRIVER_ERRORS.TOO_LONG);
    expect(state.updatePayloads).toEqual([]);
  });

  it("reports an order without a shipment", async () => {
    state.updateResult = { data: [], error: null };

    await expect(
      DeliveryService.setDriverForOrder(9, "Juan P."),
    ).rejects.toThrow(DRIVER_ERRORS.NO_SHIPMENT);
  });

  it("reports the pending migration when the column does not exist yet", async () => {
    state.updateResult = {
      data: null,
      error: { code: "42703", message: 'column "driver_name" does not exist' },
    };

    await expect(
      DeliveryService.setDriverForOrder(9, "Juan P."),
    ).rejects.toThrow(DRIVER_ERRORS.COLUMN_MISSING);
  });

  it("reads the order's current driver and the known driver names", async () => {
    state.driverRows = [
      { id: 3, driver_name: "Juan P." },
      { driver_name: "Carlos R." },
    ];

    await expect(DeliveryService.getDriverForOrder(9)).resolves.toEqual({
      shipmentId: 3,
      driverName: "Juan P.",
    });
    await expect(DeliveryService.listDriverNames()).resolves.toEqual([
      "Carlos R.",
      "Juan P.",
    ]);
  });

  it("reads the order's latest shipment when there is more than one (H-2)", async () => {
    latestCalls.length = 0;
    state.driverRows = [{ id: 5, driver_name: "Juan P." }];

    await DeliveryService.getDriverForOrder(9);

    expect(latestCalls).toEqual([
      ["order", "created_at", { ascending: false }],
      ["order", "id", { ascending: false }],
      ["limit", 1],
    ]);
  });
});
