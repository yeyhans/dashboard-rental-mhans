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

// R-09c: the close now sends "Pedido completado"; the email itself is tested elsewhere.
vi.mock("../transactionalEmailService", () => ({
  TransactionalEmailService: {
    sendForOrder: vi.fn(async () => ({ sent: true })),
  },
}));

vi.mock("../orderService", () => ({
  OrderService: { getOrderById, updateOrderStatus },
}));

vi.mock("../../lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "orders") throw new Error(`unexpected ${table}`);
      return {
        // `getReturnReport` (H-4: checked before the final step): no report stored by default.
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { id: 7 }, error: null }),
          }),
        }),
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

/* H-2: finalize is resumable --------------------------------------------------------------- */

describe("OrderLifecycleService.finalizeReturn — resumable (H-2)", () => {
  beforeEach(() => {
    updateOrderStatus.mockImplementation(
      async (id: number, status: string) => ({ id, status }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    reportWrites.length = 0;
    reportResult.value = { error: null };
  });

  it("succeeds without changes when the order is already completed with its report", async () => {
    getOrderById.mockResolvedValue({
      id: 7,
      status: "completed",
      order_fecha_termino: "2026-10-12",
    });
    vi.spyOn(OrderLifecycleService, "getReturnReport").mockResolvedValue({
      lines: [],
    });

    const result = await OrderLifecycleService.finalizeReturn(input());

    expect(result.steps).toEqual([]);
    expect(updateOrderStatus).not.toHaveBeenCalled();
    expect(reportWrites).toEqual([]);
  });

  it("lets an admin write the missing report of an already completed order", async () => {
    getOrderById.mockResolvedValue({
      id: 7,
      status: "completed",
      order_fecha_termino: "2026-10-12",
    });
    vi.spyOn(OrderLifecycleService, "getReturnReport").mockResolvedValue(null);

    const result = await OrderLifecycleService.finalizeReturn(
      input({ role: "admin" }),
    );

    expect(result.steps).toEqual([]);
    expect(updateOrderStatus).not.toHaveBeenCalled();
    expect(reportWrites).toHaveLength(1);
  });

  it("reports where the order stopped when a step fails midway", async () => {
    getOrderById.mockResolvedValue({
      id: 7,
      status: "in-rental",
      order_fecha_termino: "2026-10-12",
    });
    updateOrderStatus
      .mockResolvedValueOnce({ id: 7, status: "return" })
      .mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const error = await OrderLifecycleService.finalizeReturn(input()).catch(
      (e) => e,
    );

    expect(error).toBeInstanceOf(ReturnFinalizeError);
    expect(error.status).toBe(409);
    expect(error.code).toBe("PARTIAL_CLOSE");
    expect(error.currentStatus).toBe("return");
    expect(error.message).toContain("Devolución");
    // H-4: the report is written before the final step, so it is already in place for the retry.
    expect(reportWrites).toHaveLength(1);
  });
});

/* H-3: the completed shortcut never rewrites, and an operator cannot report on an order that
   was completed by another path. */
describe("OrderLifecycleService.finalizeReturn — completed orders (H-3)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    reportWrites.length = 0;
  });

  it("never rewrites an existing report, whoever asks", async () => {
    getOrderById.mockResolvedValue({
      id: 7,
      status: "completed",
      order_fecha_termino: "2026-10-12",
    });
    vi.spyOn(OrderLifecycleService, "getReturnReport").mockResolvedValue({
      lines: [],
    });

    for (const role of ["admin", "operator"]) {
      const result = await OrderLifecycleService.finalizeReturn(
        input({ role }),
      );
      expect(result.steps).toEqual([]);
    }
    expect(reportWrites).toEqual([]);
  });

  it("refuses an operator report on a completed order without one (409)", async () => {
    getOrderById.mockResolvedValue({
      id: 7,
      status: "completed",
      order_fecha_termino: "2026-10-12",
    });
    vi.spyOn(OrderLifecycleService, "getReturnReport").mockResolvedValue(null);

    await expect(
      OrderLifecycleService.finalizeReturn(input({ role: "operator" })),
    ).rejects.toMatchObject({ status: 409, code: "ALREADY_COMPLETED" });
    expect(reportWrites).toEqual([]);
  });
});

/* R-09c: closing a return from the reception panel sends "Pedido completado" like any other
   path into `completed` — through `onStatusChanged`, once. */
describe("OrderLifecycleService.finalizeReturn — email (R-09c)", () => {
  beforeEach(() => {
    updateOrderStatus.mockImplementation(
      async (id: number, status: string) => ({ id, status }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    reportWrites.length = 0;
  });

  it("runs the lifecycle once for the whole close, from the original status", async () => {
    getOrderById.mockResolvedValue({
      id: 7,
      status: "in-rental",
      order_fecha_termino: "2026-10-12",
    });
    const lifecycle = vi
      .spyOn(OrderLifecycleService, "onStatusChanged")
      .mockResolvedValue({ generated: false, warning: "Correo no enviado." });

    const result = await OrderLifecycleService.finalizeReturn(input());

    expect(lifecycle).toHaveBeenCalledTimes(1);
    expect(lifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, status: "completed" }),
      "completed",
      { previousStatus: "in-rental" },
    );
    expect(result.warning).toContain("Correo no enviado.");
  });
});

/* H-4 (R3/R4 operator-retry-409): the report is written BEFORE the order is completed, so a
   close that fails on its last step can be retried by the same operator — the retry only has
   the status step left, and never rewrites the report. */
describe("OrderLifecycleService.finalizeReturn — report first (H-4)", () => {
  beforeEach(() => {
    updateOrderStatus.mockImplementation(
      async (id: number, status: string) => ({ id, status }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    reportWrites.length = 0;
  });

  it("saves the report before the final step to completed", async () => {
    getOrderById.mockResolvedValue({
      id: 7,
      status: "in-rental",
      order_fecha_termino: "2026-10-12",
    });
    vi.spyOn(OrderLifecycleService, "getReturnReport").mockResolvedValue(null);
    const save = vi.spyOn(OrderLifecycleService, "saveReturnReport");
    vi.spyOn(OrderLifecycleService, "onStatusChanged").mockResolvedValue({
      generated: false,
    });

    await OrderLifecycleService.finalizeReturn(input());

    const completedCall = updateOrderStatus.mock.calls.findIndex(
      ([, s]) => s === "completed",
    );
    const returnCall = updateOrderStatus.mock.calls.findIndex(
      ([, s]) => s === "return",
    );
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.invocationCallOrder[0]!).toBeGreaterThan(
      updateOrderStatus.mock.invocationCallOrder[returnCall]!,
    );
    expect(save.mock.invocationCallOrder[0]!).toBeLessThan(
      updateOrderStatus.mock.invocationCallOrder[completedCall]!,
    );
  });

  it("lets an operator retry when the report landed but completing failed", async () => {
    getOrderById.mockResolvedValue({
      id: 7,
      status: "return",
      order_fecha_termino: "2026-10-12",
    });
    vi.spyOn(OrderLifecycleService, "getReturnReport").mockResolvedValue({
      lines: [],
    });
    const save = vi.spyOn(OrderLifecycleService, "saveReturnReport");
    vi.spyOn(OrderLifecycleService, "onStatusChanged").mockResolvedValue({
      generated: false,
    });

    const result = await OrderLifecycleService.finalizeReturn(
      input({ role: "operator" }),
    );

    expect(result.steps).toEqual(["completed"]);
    expect(save).not.toHaveBeenCalled();
    expect(updateOrderStatus).toHaveBeenCalledWith(7, "completed");
  });
});
