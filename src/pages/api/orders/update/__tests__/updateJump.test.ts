import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Admin status jump (2026-10-14) through the full edit route: when the edit changes the status it
 * follows the status route — `notify` reaches the lifecycle, a cancel stores its reason, and open
 * checkouts ask for confirmation before closing or rolling back the order.
 */
const updateOrder = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
const onStatusChanged = vi.hoisted(() =>
  vi.fn(async (): Promise<{ generated: boolean }> => ({ generated: false })),
);
const listOpenCheckoutsForOrder = vi.hoisted(() =>
  vi.fn(async (): Promise<string[]> => []),
);

vi.mock("../../../../../services/orderPricingService", () => ({
  OrderPricingService: { priceOrderUpdate: vi.fn(async () => null) },
}));

vi.mock("../../../../../middleware/auth", () => ({
  withAuth:
    (handler: (context: any) => Promise<Response>) => async (context: any) =>
      handler(context),
}));

vi.mock("../../../../../services/orderService", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../../../../services/orderService")
  >()),
  OrderService: { updateOrder },
}));

vi.mock("../../../../../lib/supabase", () => ({
  supabaseAdmin: { from },
}));

vi.mock("../../../../../services/orderLifecycleService", () => ({
  OrderLifecycleService: { onStatusChanged },
}));

vi.mock("../../../../../services/assetMovementService", () => ({
  AssetMovementService: { listOpenCheckoutsForOrder },
}));

function stubCurrentOrder(status: string) {
  from.mockReturnValue({
    select: () => ({
      eq: () => ({
        single: async () => ({ data: { id: 123, status }, error: null }),
      }),
    }),
  });
}

async function put(body: Record<string, unknown>, role = "admin") {
  const { PUT } = await import("../[id]");
  return PUT({
    params: { id: "123" },
    request: new Request("https://dashboard.mariohans.cl/api/orders/update/123", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    locals: { user: { id: "admin-1", role } },
    user: { id: "admin-1", role },
  } as never);
}

describe("PUT /api/orders/update/[id] — admin jump", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lets an admin jump and passes notify to the lifecycle", async () => {
    stubCurrentOrder("request");
    updateOrder.mockResolvedValue({ id: 123, status: "preparation" });

    const response = await put({ status: "preparation", notify: true });

    expect(response.status).toBe(200);
    expect(onStatusChanged).toHaveBeenCalledWith(
      { id: 123, status: "preparation" },
      "preparation",
      { previousStatus: "request", notify: true },
    );
  });

  it("never writes the request flags as order columns", async () => {
    stubCurrentOrder("request");
    updateOrder.mockResolvedValue({ id: 123, status: "preparation" });

    await put({
      status: "preparation",
      notify: true,
      acknowledge_open_checkouts: true,
      reason: "x",
    });

    const saved = updateOrder.mock.calls[0]![1];
    expect(saved).not.toHaveProperty("notify");
    expect(saved).not.toHaveProperty("acknowledge_open_checkouts");
    expect(saved).not.toHaveProperty("reason");
    expect(saved).not.toHaveProperty("cancellation_reason");
  });

  it("stores the reason as cancellation_reason when cancelling", async () => {
    stubCurrentOrder("confirmed");
    updateOrder.mockResolvedValue({ id: 123, status: "cancelled" });

    await put({ status: "cancelled", reason: "  Sin stock " });

    expect(updateOrder.mock.calls[0]![1]).toMatchObject({
      status: "cancelled",
      cancellation_reason: "Sin stock",
    });
  });

  it("rejects a reason longer than 500 characters", async () => {
    stubCurrentOrder("confirmed");

    const response = await put({ status: "cancelled", reason: "x".repeat(501) });

    expect(response.status).toBe(400);
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it("asks before completing an order with units still out", async () => {
    stubCurrentOrder("in-rental");
    listOpenCheckoutsForOrder.mockResolvedValueOnce(["MH-00004"]);

    const response = await put({ status: "completed" });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "OPEN_CHECKOUTS",
      data: { asset_tags: ["MH-00004"] },
    });
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it("goes ahead once the admin acknowledged the open checkouts", async () => {
    stubCurrentOrder("in-rental");
    listOpenCheckoutsForOrder.mockResolvedValueOnce(["MH-00004"]);
    updateOrder.mockResolvedValue({ id: 123, status: "completed" });

    const response = await put({
      status: "completed",
      acknowledge_open_checkouts: true,
    });

    expect(response.status).toBe(200);
    expect(updateOrder).toHaveBeenCalled();
  });

  it("does not look for checkouts when the status does not change", async () => {
    stubCurrentOrder("in-rental");
    updateOrder.mockResolvedValue({ id: 123, status: "in-rental" });

    const response = await put({ status: "in-rental", customer_note: "hola" });

    expect(response.status).toBe(200);
    expect(listOpenCheckoutsForOrder).not.toHaveBeenCalled();
    expect(onStatusChanged).not.toHaveBeenCalled();
  });
});
