import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * H-3 (follow-up of R-05): an admin-created order keeps its manual percentage in
 * `orders.discount_percent`. A customer (frontend) can never set it. Before migration 0019 the
 * insert is retried without the column and the creation answers with a warning.
 */
const from = vi.hoisted(() => vi.fn());
const priceNewOrder = vi.hoisted(() => vi.fn());
const inserts = vi.hoisted(() => [] as Record<string, unknown>[][]);
const insertResults = vi.hoisted(
  () => [] as { data: unknown; error: unknown }[],
);

vi.mock("../../lib/supabase", () => ({ supabaseAdmin: { from } }));
vi.mock("../couponService", () => ({
  CouponService: {
    syncOrderCouponUsage: vi.fn(),
    releaseOrderCouponUsage: vi.fn(),
  },
}));
vi.mock("../orderPricingService", () => ({
  OrderPricingService: { priceNewOrder, priceOrderUpdate: vi.fn() },
}));

const { OrderService, DISCOUNT_PERCENT_COLUMN_WARNING } = await import(
  "../orderService"
);
const { PricingError } = await import("../../lib/pricing");

const PRICED = { calculated_discount: 8100, calculated_total: 100 };

beforeEach(() => {
  inserts.length = 0;
  insertResults.length = 0;
  priceNewOrder.mockReset().mockResolvedValue(PRICED);
  from.mockReturnValue({
    insert: (rows: Record<string, unknown>[]) => {
      inserts.push(rows);
      return {
        select: () => ({
          single: async () =>
            insertResults.shift() ?? {
              data: { id: 9, ...rows[0] },
              error: null,
            },
        }),
      };
    },
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OrderService.createOrderDetailed — discount_percent", () => {
  it("stores an admin's percentage and prices with it", async () => {
    const { order, warning } = await OrderService.createOrderDetailed(
      { customer_id: 1, discount_percent: "10" } as never,
      "admin",
    );

    expect(priceNewOrder).toHaveBeenCalledWith(
      expect.objectContaining({ discount_percent: 10 }),
      "admin",
    );
    expect(inserts[0]![0]).toMatchObject({
      discount_percent: 10,
      calculated_discount: 8100,
    });
    expect(warning).toBeUndefined();
    expect(order).toMatchObject({ id: 9 });
  });

  it("never lets a customer set a percentage", async () => {
    await OrderService.createOrderDetailed(
      { customer_id: 1, discount_percent: 90 } as never,
      "frontend",
    );

    expect(priceNewOrder.mock.calls[0]![0]).not.toHaveProperty(
      "discount_percent",
    );
    expect(inserts[0]![0]).not.toHaveProperty("discount_percent");
  });

  it("rejects an out-of-range percentage before inserting", async () => {
    await expect(
      OrderService.createOrderDetailed(
        { customer_id: 1, discount_percent: 150 } as never,
        "admin",
      ),
    ).rejects.toThrow(PricingError);
    expect(inserts).toEqual([]);
  });

  it("retries without the column before migration 0019 and warns", async () => {
    insertResults.push({
      data: null,
      error: {
        code: "PGRST204",
        message: "Could not find the 'discount_percent' column",
      },
    });

    const { order, warning } = await OrderService.createOrderDetailed(
      { customer_id: 1, discount_percent: 10 } as never,
      "admin",
    );

    expect(inserts).toHaveLength(2);
    expect(inserts[1]![0]).not.toHaveProperty("discount_percent");
    expect(inserts[1]![0]).toMatchObject({ calculated_discount: 8100 });
    expect(warning).toBe(DISCOUNT_PERCENT_COLUMN_WARNING);
    expect(order).toMatchObject({ id: 9 });
  });

  it("keeps createOrder returning just the order", async () => {
    const order = await OrderService.createOrder(
      { customer_id: 1 } as never,
      "admin",
    );
    expect(order).toMatchObject({ id: 9 });
  });
});

/* H-4 (R3/R4): the retry is only for THE missing column, never for any other undefined column. */
describe("OrderService.createOrderDetailed — retry scope (H-4)", () => {
  it("does not retry when the missing column is another one", async () => {
    insertResults.push({
      data: null,
      error: {
        code: "42703",
        message: 'column "otra_columna" of relation "orders" does not exist',
      },
    });

    await expect(
      OrderService.createOrderDetailed(
        { customer_id: 1, discount_percent: 10 } as never,
        "admin",
      ),
    ).rejects.toMatchObject({ code: "42703" });
    expect(inserts).toHaveLength(1);
  });

  it("prices with the same shape for every origin (apply_iva kept, no raw percentage)", async () => {
    await OrderService.createOrderDetailed(
      { customer_id: 1, apply_iva: false, discount_percent: "10" } as never,
      "admin",
    );
    await OrderService.createOrderDetailed(
      { customer_id: 1, apply_iva: false, discount_percent: "10" } as never,
      "frontend",
    );

    expect(priceNewOrder.mock.calls[0]![0]).toMatchObject({
      apply_iva: false,
      discount_percent: 10,
    });
    expect(priceNewOrder.mock.calls[1]![0]).toMatchObject({ apply_iva: false });
    expect(priceNewOrder.mock.calls[1]![0]).not.toHaveProperty(
      "discount_percent",
    );
  });
});
