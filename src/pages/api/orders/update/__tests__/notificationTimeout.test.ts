import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * D-4 (A-03) reproduction at the route level: moving an order to `completed` makes the update
 * route call the email endpoint BEFORE persisting. When that call never answers, the route used to
 * wait for ever (the order stays in `return`, the tab stays on "Guardando..."). It must now give up
 * with a Spanish 504 and leave the order untouched.
 */
const updateOrder = vi.fn();
const from = vi.fn();
const priceOrderUpdate = vi.hoisted(() =>
  vi.fn(async (): Promise<unknown> => null),
);

vi.mock("../../../../../services/orderPricingService", () => ({
  OrderPricingService: { priceOrderUpdate },
}));

vi.mock("../../../../../middleware/auth", () => ({
  withAuth:
    (handler: (context: any) => Promise<Response>) => async (context: any) =>
      handler(context),
}));

vi.mock("../../../../../services/orderService", () => ({
  OrderService: { updateOrder },
}));

vi.mock("../../../../../lib/supabase", () => ({
  supabaseAdmin: { from },
}));

describe("PUT /api/orders/update/[id] when the notification hop hangs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("FRONTEND_API_SECRET", "frontend-secret");
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: 123,
              status: "return",
              billing_email: "cliente@example.com",
            },
            error: null,
          }),
        }),
      }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("answers 504 with a Spanish message and does not touch the order", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(init.signal?.reason ?? new Error("aborted")),
            );
          }),
      ),
    );
    const request = new Request(
      "https://dashboard.mariohans.cl/api/orders/update/123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      },
    );
    const { PUT } = await import("../[id]");

    const pending = PUT({
      params: { id: "123" },
      request,
      locals: { user: { id: "admin-1" } },
    } as never);
    await vi.advanceTimersByTimeAsync(60_000);
    const response = await pending;
    const body = await response.json();

    expect(response.status).toBe(504);
    expect(body.success).toBe(false);
    expect(body.notificationError).toBe("notification_timeout");
    expect(body.error).toMatch(/correo/i);
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it("also answers with a Spanish error (not a blank one) when the internal secret is missing", async () => {
    vi.stubEnv("FRONTEND_API_SECRET", "");
    vi.stubGlobal("fetch", vi.fn());
    const request = new Request(
      "https://dashboard.mariohans.cl/api/orders/update/123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      },
    );
    const { PUT } = await import("../[id]");

    const response = await PUT({
      params: { id: "123" },
      request,
      locals: { user: { id: "admin-1" } },
    } as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(typeof body.error).toBe("string");
    expect(updateOrder).not.toHaveBeenCalled();
  });
});
