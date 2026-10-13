import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * R-06: `GET|PUT /api/delivery/orders/[orderId]/driver`. The order edit screen knows the order,
 * not the `shipping_usage` row, so the driver is read and written by order id. Admin only.
 */
const getDriverForOrder = vi.hoisted(() => vi.fn());
const listDriverNames = vi.hoisted(() => vi.fn());
const setDriverForOrder = vi.hoisted(() => vi.fn());

vi.mock("../../../../../middleware/auth", () => ({
  withAuth:
    (handler: (context: any) => Promise<Response>) => async (context: any) => {
      if (!context.locals?.user) {
        return new Response(
          JSON.stringify({ success: false, error: "No autorizado" }),
          { status: 401 },
        );
      }
      return handler(context);
    },
}));

vi.mock("../../../../../services/deliveryService", () => ({
  DeliveryService: { getDriverForOrder, listDriverNames, setDriverForOrder },
}));

const { DRIVER_ERRORS } = await import("../../../../../lib/delivery");
const route = await import("../[orderId]/driver");

function ctx(
  method: string,
  orderId: string,
  body?: unknown,
  user: unknown = { id: "a" },
) {
  return {
    params: { orderId },
    request: new Request(
      `https://dash.example.cl/api/delivery/orders/${orderId}/driver`,
      {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    ),
    locals: user ? { user } : {},
  } as never;
}

describe("/api/delivery/orders/[orderId]/driver", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an unauthenticated caller", async () => {
    const response = await route.PUT(
      ctx("PUT", "9", { driver_name: "Juan" }, null),
    );
    expect(response.status).toBe(401);
    expect(setDriverForOrder).not.toHaveBeenCalled();
  });

  it("answers 400 for an invalid order id", async () => {
    const response = await route.PUT(
      ctx("PUT", "abc", { driver_name: "Juan" }),
    );
    expect(response.status).toBe(400);
  });

  it("returns the current driver and the known names", async () => {
    getDriverForOrder.mockResolvedValue({
      shipmentId: 3,
      driverName: "Juan P.",
    });
    listDriverNames.mockResolvedValue(["Carlos R.", "Juan P."]);

    const response = await route.GET(ctx("GET", "9"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        shipmentId: 3,
        driverName: "Juan P.",
        knownDrivers: ["Carlos R.", "Juan P."],
      },
    });
  });

  it("saves the driver through the service", async () => {
    setDriverForOrder.mockResolvedValue({
      shipmentId: 3,
      driverName: "Juan P.",
    });

    const response = await route.PUT(
      ctx("PUT", "9", { driver_name: " Juan P. " }),
    );

    expect(response.status).toBe(200);
    expect(setDriverForOrder).toHaveBeenCalledWith(9, " Juan P. ");
  });

  it("maps validation, missing shipment and pending migration to client errors", async () => {
    setDriverForOrder.mockRejectedValueOnce(new Error(DRIVER_ERRORS.TOO_LONG));
    expect(
      (await route.PUT(ctx("PUT", "9", { driver_name: "x" }))).status,
    ).toBe(400);

    setDriverForOrder.mockRejectedValueOnce(
      new Error(DRIVER_ERRORS.NO_SHIPMENT),
    );
    expect(
      (await route.PUT(ctx("PUT", "9", { driver_name: "x" }))).status,
    ).toBe(404);

    setDriverForOrder.mockRejectedValueOnce(
      new Error(DRIVER_ERRORS.COLUMN_MISSING),
    );
    expect(
      (await route.PUT(ctx("PUT", "9", { driver_name: "x" }))).status,
    ).toBe(503);
  });

  it("hides unexpected errors behind a generic 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setDriverForOrder.mockRejectedValueOnce(new Error("relation secret"));

    const response = await route.PUT(ctx("PUT", "9", { driver_name: "x" }));

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});
