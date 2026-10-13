import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * R-14 wiring: after a successful status change the route hands the saved order to
 * `OrderLifecycleService.onStatusChanged`, and a lifecycle warning travels in the response
 * without turning the status change into an error.
 */
const updateOrderStatus = vi.hoisted(() => vi.fn());
const getOrderById = vi.hoisted(() => vi.fn());
const onStatusChanged = vi.hoisted(() => vi.fn());

vi.mock("../../../../../middleware/auth", () => ({
  withAuth:
    (handler: (context: any) => Promise<Response>) => async (context: any) =>
      handler({ ...context, user: { id: "admin-1", role: "admin" } }),
}));

vi.mock("../../../../../services/orderService", () => ({
  OrderService: { updateOrderStatus, getOrderById },
}));

vi.mock("../../../../../services/orderLifecycleService", () => ({
  OrderLifecycleService: { onStatusChanged },
}));

function context(status: string) {
  const href = "https://dashboard.mariohans.cl/api/orders/123/status";
  return {
    params: { id: "123" },
    url: new URL(href),
    request: new Request(href, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }),
  } as never;
}

describe("PUT /api/orders/[id]/status lifecycle hook", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("passes the saved order and new status to the lifecycle service", async () => {
    getOrderById.mockResolvedValue({ id: 123, status: "preparation" });
    const saved = {
      id: 123,
      status: "in-rental",
      new_pdf_processing_url: null,
    };
    updateOrderStatus.mockResolvedValue(saved);
    onStatusChanged.mockResolvedValue({ generated: true });
    const { PUT } = await import("../status");

    const response = await PUT(context("in-rental"));

    expect(response.status).toBe(200);
    expect(onStatusChanged).toHaveBeenCalledWith(saved, "in-rental");
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.warning).toBeUndefined();
  });

  it("keeps the 200 and adds the warning when the contract could not be generated", async () => {
    getOrderById.mockResolvedValue({ id: 123, status: "preparation" });
    updateOrderStatus.mockResolvedValue({ id: 123, status: "in-rental" });
    onStatusChanged.mockResolvedValue({
      generated: false,
      warning: "No se pudo generar el contrato",
    });
    const { PUT } = await import("../status");

    const response = await PUT(context("in-rental"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        warning: "No se pudo generar el contrato",
      }),
    );
  });

  it("does not call the lifecycle hook when the status change is rejected", async () => {
    getOrderById.mockResolvedValue({ id: 123, status: "request" });
    const { PUT } = await import("../status");

    const response = await PUT(context("in-rental"));

    expect(response.status).toBe(409);
    expect(onStatusChanged).not.toHaveBeenCalled();
  });
});
