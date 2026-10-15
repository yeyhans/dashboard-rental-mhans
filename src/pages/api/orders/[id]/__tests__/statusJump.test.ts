import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Admin status jump (2026-10-14, `odd/tasks/admin-status-jump.md`). The route accepts
 * `{ status, notify?, reason?, acknowledge_open_checkouts? }`: admins may jump, a jump only emails
 * the customer with `notify: true`, a cancel stores its reason, and closing or rolling back an
 * order with units still out asks for confirmation first.
 */
const updateOrderStatus = vi.hoisted(() => vi.fn());
const getOrderById = vi.hoisted(() => vi.fn());
const onStatusChanged = vi.hoisted(() => vi.fn());
const listOpenCheckoutsForOrder = vi.hoisted(() => vi.fn());
const role = vi.hoisted(() => ({ value: "admin" }));

vi.mock("../../../../../middleware/auth", () => ({
  withAuth:
    (handler: (context: any) => Promise<Response>) => async (context: any) =>
      handler({ ...context, user: { id: "admin-1", role: role.value } }),
}));

vi.mock("../../../../../services/orderService", () => ({
  OrderService: { updateOrderStatus, getOrderById },
}));

vi.mock("../../../../../services/orderLifecycleService", () => ({
  OrderLifecycleService: { onStatusChanged },
}));

vi.mock("../../../../../services/assetMovementService", () => ({
  AssetMovementService: { listOpenCheckoutsForOrder },
}));

function context(body: Record<string, unknown>) {
  const href = "https://dashboard.mariohans.cl/api/orders/123/status";
  return {
    params: { id: "123" },
    url: new URL(href),
    request: new Request(href, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as never;
}

async function put(body: Record<string, unknown>) {
  const { PUT } = await import("../status");
  return PUT(context(body));
}

describe("PUT /api/orders/[id]/status — admin jump", () => {
  afterEach(() => {
    vi.clearAllMocks();
    role.value = "admin";
  });

  it("lets an admin skip stages and passes notify to the lifecycle", async () => {
    getOrderById.mockResolvedValue({ id: 123, status: "request" });
    updateOrderStatus.mockResolvedValue({ id: 123, status: "confirmed" });
    onStatusChanged.mockResolvedValue({ generated: false });

    const response = await put({ status: "confirmed", notify: true });

    expect(response.status).toBe(200);
    expect(onStatusChanged).toHaveBeenCalledWith(
      { id: 123, status: "confirmed" },
      "confirmed",
      { previousStatus: "request", notify: true },
    );
  });

  it("does not ask for notify when the admin leaves the box unticked", async () => {
    getOrderById.mockResolvedValue({ id: 123, status: "completed" });
    updateOrderStatus.mockResolvedValue({ id: 123, status: "return" });
    onStatusChanged.mockResolvedValue({ generated: false });

    const response = await put({ status: "return" });

    expect(response.status).toBe(200);
    expect(onStatusChanged.mock.calls[0]![2]).toEqual({
      previousStatus: "completed",
    });
  });

  it("rejects the current status with 409 SAME_STATUS", async () => {
    getOrderById.mockResolvedValue({ id: 123, status: "confirmed" });

    const response = await put({ status: "confirmed" });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "SAME_STATUS",
    });
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it("keeps operators on their forward-only steps", async () => {
    role.value = "operator";
    getOrderById.mockResolvedValue({ id: 123, status: "request" });

    const response = await put({ status: "in-rental" });

    expect(response.status).toBe(403);
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it("stores a trimmed reason as the cancellation reason", async () => {
    getOrderById.mockResolvedValue({ id: 123, status: "confirmed" });
    updateOrderStatus.mockResolvedValue({ id: 123, status: "cancelled" });
    listOpenCheckoutsForOrder.mockResolvedValue([]);
    onStatusChanged.mockResolvedValue({ generated: false });

    const response = await put({
      status: "cancelled",
      reason: "  Cliente desistió  ",
    });

    expect(response.status).toBe(200);
    expect(updateOrderStatus).toHaveBeenCalledWith(123, "cancelled", undefined, {
      cancellationReason: "Cliente desistió",
    });
  });

  it("ignores the reason when the order is not being cancelled", async () => {
    getOrderById.mockResolvedValue({ id: 123, status: "request" });
    updateOrderStatus.mockResolvedValue({ id: 123, status: "evaluation" });
    onStatusChanged.mockResolvedValue({ generated: false });

    await put({ status: "evaluation", reason: "algo" });

    expect(updateOrderStatus).toHaveBeenCalledWith(123, "evaluation");
  });

  it("rejects a reason longer than 500 characters", async () => {
    getOrderById.mockResolvedValue({ id: 123, status: "confirmed" });

    const response = await put({ status: "cancelled", reason: "x".repeat(501) });

    expect(response.status).toBe(400);
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it("rejects a reason that is not text", async () => {
    getOrderById.mockResolvedValue({ id: 123, status: "confirmed" });

    const response = await put({ status: "cancelled", reason: 42 });

    expect(response.status).toBe(400);
  });
});

describe("PUT /api/orders/[id]/status — open checkouts", () => {
  afterEach(() => {
    vi.clearAllMocks();
    role.value = "admin";
  });

  it("asks before completing an order with units still out", async () => {
    getOrderById.mockResolvedValue({ id: 123, status: "in-rental" });
    listOpenCheckoutsForOrder.mockResolvedValue(["MH-00001", "MH-00002"]);

    const response = await put({ status: "completed" });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "OPEN_CHECKOUTS",
      data: { asset_tags: ["MH-00001", "MH-00002"] },
    });
    expect(listOpenCheckoutsForOrder).toHaveBeenCalledWith(123);
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it("asks before sending an order on rent back to confirmed", async () => {
    getOrderById.mockResolvedValue({ id: 123, status: "return" });
    listOpenCheckoutsForOrder.mockResolvedValue(["MH-00009"]);

    const response = await put({ status: "confirmed" });

    expect(response.status).toBe(409);
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it("goes ahead when the admin acknowledged the open checkouts", async () => {
    getOrderById.mockResolvedValue({ id: 123, status: "in-rental" });
    listOpenCheckoutsForOrder.mockResolvedValue(["MH-00001"]);
    updateOrderStatus.mockResolvedValue({ id: 123, status: "cancelled" });
    onStatusChanged.mockResolvedValue({ generated: false });

    const response = await put({
      status: "cancelled",
      acknowledge_open_checkouts: true,
    });

    expect(response.status).toBe(200);
    expect(listOpenCheckoutsForOrder).not.toHaveBeenCalled();
    expect(updateOrderStatus).toHaveBeenCalled();
  });

  it("goes ahead when nothing is out", async () => {
    getOrderById.mockResolvedValue({ id: 123, status: "in-rental" });
    listOpenCheckoutsForOrder.mockResolvedValue([]);
    updateOrderStatus.mockResolvedValue({ id: 123, status: "completed" });
    onStatusChanged.mockResolvedValue({ generated: false });

    const response = await put({ status: "completed" });

    expect(response.status).toBe(200);
  });

  it("does not look for checkouts on the normal in-rental -> return step", async () => {
    getOrderById.mockResolvedValue({ id: 123, status: "in-rental" });
    updateOrderStatus.mockResolvedValue({ id: 123, status: "return" });
    onStatusChanged.mockResolvedValue({ generated: false });

    const response = await put({ status: "return" });

    expect(response.status).toBe(200);
    expect(listOpenCheckoutsForOrder).not.toHaveBeenCalled();
  });
});
