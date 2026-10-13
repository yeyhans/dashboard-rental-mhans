import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * R-02: an order whose rental period has ended moves from `in-rental` to `return` on its own.
 * The hourly cron calls `OrderService.moveExpiredRentalsToReturn`.
 *
 * The write is a compare-and-set (`WHERE id = ? AND status = 'in-rental'`): an admin can change
 * the order between the cron's read and its write, and the cron must not overwrite that change.
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

type UpdateOutcome = { data: unknown; error: unknown };

/**
 * `from('orders')` serves the expired-orders select first, then one conditional update per id.
 * `updates[id]` is what that id's `update().eq().eq().select()` resolves to.
 */
function stubOrders(
  selectResult: { data: unknown; error: unknown },
  updates: Record<number, UpdateOutcome> = {},
) {
  const lt = vi.fn(async () => selectResult);
  const selectEq = vi.fn(() => ({ lt }));
  const select = vi.fn(() => ({ eq: selectEq }));

  const updatePayloads: unknown[] = [];
  const statusGuards: unknown[][] = [];
  const update = vi.fn((payload: unknown) => {
    updatePayloads.push(payload);
    return {
      eq: (_idColumn: string, id: number) => ({
        eq: (...guard: unknown[]) => {
          statusGuards.push(guard);
          return {
            select: async () => updates[id] ?? { data: [{ id }], error: null },
          };
        },
      }),
    };
  });

  from.mockReturnValue({ select, update });
  return { selectEq, lt, update, updatePayloads, statusGuards };
}

describe("OrderService.moveExpiredRentalsToReturn", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    from.mockReset();
  });

  it("selects in-rental orders whose end date is before today in Chile", async () => {
    const chain = stubOrders({ data: [], error: null });

    await OrderService.moveExpiredRentalsToReturn("2026-10-13");

    expect(from).toHaveBeenCalledWith("orders");
    expect(chain.selectEq).toHaveBeenCalledWith("status", "in-rental");
    expect(chain.lt).toHaveBeenCalledWith("order_fecha_termino", "2026-10-13");
  });

  it("moves each expired order to return with a compare-and-set on in-rental", async () => {
    const chain = stubOrders({ data: [{ id: 7 }, { id: 9 }], error: null });

    const result = await OrderService.moveExpiredRentalsToReturn("2026-10-13");

    expect(chain.updatePayloads).toEqual([
      expect.objectContaining({
        status: "return",
        date_modified: expect.any(String),
      }),
      expect.objectContaining({
        status: "return",
        date_modified: expect.any(String),
      }),
    ]);
    expect(chain.statusGuards).toEqual([
      ["status", "in-rental"],
      ["status", "in-rental"],
    ]);
    expect(result).toEqual({ moved: 2, ids: [7, 9], skipped: 0 });
  });

  it("skips an order that changed status between the read and the write", async () => {
    stubOrders(
      { data: [{ id: 7 }, { id: 9 }], error: null },
      { 7: { data: [], error: null } },
    );

    const result = await OrderService.moveExpiredRentalsToReturn("2026-10-13");

    expect(result).toEqual({ moved: 1, ids: [9], skipped: 1 });
  });

  it("is idempotent: nothing left in-rental means nothing moves", async () => {
    const chain = stubOrders({ data: [], error: null });

    const result = await OrderService.moveExpiredRentalsToReturn("2026-10-13");

    expect(chain.update).not.toHaveBeenCalled();
    expect(result).toEqual({ moved: 0, ids: [], skipped: 0 });
  });

  it("keeps going when one write fails and reports only the moved ones", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubOrders(
      { data: [{ id: 7 }, { id: 9 }], error: null },
      { 7: { data: null, error: new Error("boom") } },
    );

    const result = await OrderService.moveExpiredRentalsToReturn("2026-10-13");

    expect(result).toEqual({ moved: 1, ids: [9], skipped: 0 });
  });

  it("throws when the select fails", async () => {
    stubOrders({ data: null, error: new Error("db down") });

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
