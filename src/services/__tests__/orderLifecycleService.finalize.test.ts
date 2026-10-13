import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * R-04b: `OrderLifecycleService.finalizeReturn` closes a return from the shared reception panel
 * (/check-in and /bodega). It validates the report, walks the order to `completed` one legal step
 * at a time through the shared gate (operators included, via `allowOperatorClosing`), and saves
 * `orders.return_report`. A missing column (migration 0018 not applied) does not block the close.
 */
const getOrderById = vi.hoisted(() => vi.fn());
const updateOrderStatus = vi.hoisted(() => vi.fn());
const reportWrites = vi.hoisted(() => [] as unknown[]);
const reportResult = vi.hoisted(() => ({ value: { error: null as unknown } }));

vi.mock("../orderService", () => ({
  OrderService: { getOrderById, updateOrderStatus },
}));

vi.mock("../../lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "orders") throw new Error(`unexpected ${table}`);
      return {
        update: (payload: unknown) => {
          reportWrites.push(payload);
          return { eq: async () => reportResult.value };
        },
      };
    },
  },
}));

const {
  OrderLifecycleService,
  ReturnFinalizeError,
  RETURN_REPORT_COLUMN_WARNING,
} = await import("../orderLifecycleService");

const LINES = [
  {
    key: "0",
    label: "Cámara",
    state: "received",
    incident_type: null,
    note: null,
  },
  {
    key: "1",
    label: "Flash",
    state: "damaged",
    incident_type: "Falla eléctrica",
    note: "no enciende",
  },
];

function input(overrides: Record<string, unknown> = {}) {
  return {
    orderId: 7,
    role: "operator",
    actorId: "op-1",
    lines: LINES,
    todayChile: "2026-10-13",
    ...overrides,
  };
}

describe("OrderLifecycleService.finalizeReturn", () => {
  beforeEach(() => {
    updateOrderStatus.mockImplementation(
      async (id: number, status: string) => ({
        id,
        status,
      }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    reportWrites.length = 0;
    reportResult.value = { error: null };
  });

  it("lets an operator close a return and saves the report", async () => {
    getOrderById.mockResolvedValue({
      id: 7,
      status: "return",
      order_fecha_termino: "2026-10-12",
    });

    const result = await OrderLifecycleService.finalizeReturn(input());

    expect(updateOrderStatus).toHaveBeenCalledTimes(1);
    expect(updateOrderStatus).toHaveBeenCalledWith(7, "completed");
    expect(result.steps).toEqual(["completed"]);
    expect(result.warning).toBeUndefined();
    expect(reportWrites).toEqual([
      {
        return_report: {
          finalized_at: expect.any(String),
          finalized_by: "op-1",
          lines: LINES,
        },
      },
    ]);
  });

  it("walks a due in-rental order through return first", async () => {
    getOrderById.mockResolvedValue({
      id: 7,
      status: "in-rental",
      order_fecha_termino: "2026-10-13",
    });

    const result = await OrderLifecycleService.finalizeReturn(input());

    expect(updateOrderStatus.mock.calls).toEqual([
      [7, "return"],
      [7, "completed"],
    ]);
    expect(result.steps).toEqual(["return", "completed"]);
  });

  it("refuses an in-rental order whose rental has not ended (409)", async () => {
    getOrderById.mockResolvedValue({
      id: 7,
      status: "in-rental",
      order_fecha_termino: "2026-10-20",
    });

    await expect(
      OrderLifecycleService.finalizeReturn(input()),
    ).rejects.toMatchObject({
      status: 409,
    });
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it("refuses an order that is not in rental or return (409)", async () => {
    getOrderById.mockResolvedValue({
      id: 7,
      status: "preparation",
      order_fecha_termino: "2026-10-01",
    });

    const error = await OrderLifecycleService.finalizeReturn(input()).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ReturnFinalizeError);
    expect(error.status).toBe(409);
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it("answers 404 for a missing order", async () => {
    getOrderById.mockResolvedValue(null);

    await expect(
      OrderLifecycleService.finalizeReturn(input()),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it("rejects an invalid report before touching the order (400)", async () => {
    getOrderById.mockResolvedValue({
      id: 7,
      status: "return",
      order_fecha_termino: "2026-10-12",
    });

    await expect(
      OrderLifecycleService.finalizeReturn(
        input({ lines: [{ key: "0", label: "x", state: "pending" }] }),
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it("still closes the return when return_report does not exist yet, with a warning", async () => {
    getOrderById.mockResolvedValue({
      id: 7,
      status: "return",
      order_fecha_termino: "2026-10-12",
    });
    reportResult.value = {
      error: {
        code: "42703",
        message: 'column "return_report" does not exist',
      },
    };

    const result = await OrderLifecycleService.finalizeReturn(input());

    expect(updateOrderStatus).toHaveBeenCalledWith(7, "completed");
    expect(result.warning).toBe(RETURN_REPORT_COLUMN_WARNING);
  });

  it("also tolerates PostgREST's schema-cache code for the missing column", async () => {
    getOrderById.mockResolvedValue({
      id: 7,
      status: "return",
      order_fecha_termino: "2026-10-12",
    });
    reportResult.value = {
      error: {
        code: "PGRST204",
        message: "Could not find the 'return_report' column",
      },
    };

    const result = await OrderLifecycleService.finalizeReturn(input());
    expect(result.warning).toBe(RETURN_REPORT_COLUMN_WARNING);
  });
});
