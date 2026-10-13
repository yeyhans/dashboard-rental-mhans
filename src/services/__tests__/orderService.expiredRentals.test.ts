import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * R-02: an order whose rental period has ended moves from `in-rental` to `return` on its own.
 * The hourly cron calls `OrderService.moveExpiredRentalsToReturn`; each move goes through
 * `updateOrderStatus` so it shares the side effects of a manual status change.
 */
const from = vi.hoisted(() => vi.fn());

vi.mock("../../lib/supabase", () => ({
  supabaseAdmin: { from },
}));

vi.mock("../couponService", () => ({
  CouponService: {},
}));

vi.mock("../orderPricingService", () => ({
  OrderPricingService: {},
}));

const { OrderService } = await import("../orderService");

function stubExpiredSelect(result: { data: unknown; error: unknown }) {
  const lt = vi.fn(async () => result);
  const eq = vi.fn(() => ({ lt }));
  const select = vi.fn(() => ({ eq }));
  from.mockReturnValue({ select });
  return { select, eq, lt };
}

describe("OrderService.moveExpiredRentalsToReturn", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    from.mockReset();
  });

  it("selects in-rental orders whose end date is before today in Chile", async () => {
    const chain = stubExpiredSelect({ data: [], error: null });
    vi.spyOn(OrderService, "updateOrderStatus").mockResolvedValue({} as never);

    await OrderService.moveExpiredRentalsToReturn("2026-10-13");

    expect(from).toHaveBeenCalledWith("orders");
    expect(chain.eq).toHaveBeenCalledWith("status", "in-rental");
    expect(chain.lt).toHaveBeenCalledWith("order_fecha_termino", "2026-10-13");
  });

  it("moves each expired order to return through updateOrderStatus", async () => {
    stubExpiredSelect({ data: [{ id: 7 }, { id: 9 }], error: null });
    const update = vi
      .spyOn(OrderService, "updateOrderStatus")
      .mockResolvedValue({} as never);

    const result = await OrderService.moveExpiredRentalsToReturn("2026-10-13");

    expect(update).toHaveBeenCalledWith(7, "return");
    expect(update).toHaveBeenCalledWith(9, "return");
    expect(result).toEqual({ moved: 2, ids: [7, 9] });
  });

  it("is idempotent: nothing left in-rental means nothing moves", async () => {
    stubExpiredSelect({ data: [], error: null });
    const update = vi.spyOn(OrderService, "updateOrderStatus");

    const result = await OrderService.moveExpiredRentalsToReturn("2026-10-13");

    expect(update).not.toHaveBeenCalled();
    expect(result).toEqual({ moved: 0, ids: [] });
  });

  it("keeps going when one order fails and reports only the moved ones", async () => {
    stubExpiredSelect({ data: [{ id: 7 }, { id: 9 }], error: null });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(OrderService, "updateOrderStatus").mockImplementation(
      async (id: number) => {
        if (id === 7) throw new Error("boom");
        return {} as never;
      },
    );

    const result = await OrderService.moveExpiredRentalsToReturn("2026-10-13");

    expect(result).toEqual({ moved: 1, ids: [9] });
  });

  it("throws when the select fails", async () => {
    stubExpiredSelect({ data: null, error: new Error("db down") });

    await expect(
      OrderService.moveExpiredRentalsToReturn("2026-10-13"),
    ).rejects.toThrow();
  });

  it("rejects a date that is not YYYY-MM-DD before querying", async () => {
    await expect(
      OrderService.moveExpiredRentalsToReturn("13/10/2026"),
    ).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });
});
