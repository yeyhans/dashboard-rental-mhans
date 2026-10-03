import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * D-4 (A-03) reproduction at the route level: a hung email hop must never keep the route waiting
 * for ever. Since D-9 the order is saved before the email, so the hop only adds a warning.
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

  it("(superseded by D-9) a hung hop no longer blocks: it answers within the deadline", async () => {
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

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.warning).toMatch(/correo/i);
    expect(updateOrder).toHaveBeenCalledTimes(1);
  });

  it("saves and warns (never a blank error) when the internal secret is missing", async () => {
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

    expect(response.status).toBe(200);
    expect(typeof body.warning).toBe("string");
    expect(updateOrder).toHaveBeenCalledTimes(1);
  });
});

/**
 * D-9: completing or cancelling an order must not depend on email delivery. The status change is
 * saved first; the email is best effort and a failure only adds a non-fatal warning.
 */
describe("PUT /api/orders/update/[id] saves first, notifies after (D-9)", () => {
  const WARNING = "La orden se guardó, pero no se pudo enviar el correo al cliente.";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("FRONTEND_API_SECRET", "frontend-secret");
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: 123, status: "return", billing_email: "cliente@example.com" },
            error: null,
          }),
        }),
      }),
    });
    updateOrder.mockResolvedValue({ id: 123, status: "completed" });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  async function put(status: string) {
    const request = new Request("https://dashboard.mariohans.cl/api/orders/update/123", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const { PUT } = await import("../[id]");
    const pending = PUT({
      params: { id: "123" },
      request,
      locals: { user: { id: "admin-1" } },
    } as never);
    await vi.advanceTimersByTimeAsync(60_000);
    const response = await pending;
    return { response, body: await response.json() };
  }

  it("saves and warns when the email hop rejects", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const { response, body } = await put("completed");
    expect(updateOrder).toHaveBeenCalledWith(123, expect.objectContaining({ status: "completed" }));
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.warning).toBe(WARNING);
    expect(body.data).toEqual({ id: 123, status: "completed" });
  });

  it("saves and warns when the email hop answers 502", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Email delivery failed", { status: 502 })));
    const { response, body } = await put("completed");
    expect(updateOrder).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.warning).toBe(WARNING);
  });

  it("saves and warns when the email hop hangs past the timeout", async () => {
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
    const { response, body } = await put("completed");
    expect(updateOrder).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(body.warning).toBe(WARNING);
  });

  it("does the same when cancelling", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 500 })));
    const { response, body } = await put("cancelled");
    expect(updateOrder).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(body.warning).toBe(WARNING);
  });

  it("has no warning when the email is delivered, and sends it once", async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const { body } = await put("completed");
    expect(body.warning).toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("persists before the email is attempted", async () => {
    const order: string[] = [];
    updateOrder.mockImplementation(async () => { order.push("save"); return { id: 123 }; });
    vi.stubGlobal("fetch", vi.fn(async () => { order.push("email"); return new Response("{}", { status: 200 }); }));
    await put("completed");
    expect(order).toEqual(["save", "email"]);
  });
});
