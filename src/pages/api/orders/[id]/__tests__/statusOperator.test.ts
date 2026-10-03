import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * D-3. An operator (garage worker) may move an order forward one step on the bodega sheet:
 * confirmed -> preparation -> in-rental -> return. Never completed, never cancelled, never back.
 * The real `withAuth` runs here (Supabase is mocked underneath), so the role gate in
 * `lib/accessControl.ts` and the endpoint's own allowlist are both exercised.
 */
const authGetUser = vi.fn();
const refreshSession = vi.fn();
const adminFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: authGetUser, refreshSession },
    from: adminFrom,
  }),
}));

const updateOrderStatus = vi.fn();
const getOrderById = vi.fn();

vi.mock("../../../../../services/orderService", () => ({
  OrderService: { updateOrderStatus, getOrderById },
}));

function stubRole(role: string) {
  authGetUser.mockResolvedValue({
    data: { user: { id: "u-1", email: "u@x.cl" } },
    error: null,
  });
  adminFrom.mockReturnValue({
    select: () => ({
      eq: () => ({
        in: () => ({
          single: () =>
            Promise.resolve({
              data: { id: 9, user_id: "u-1", email: "u@x.cl", role },
              error: null,
            }),
        }),
      }),
    }),
  });
}

function context(body: unknown, path = "/api/orders/123/status") {
  const href = `https://dashboard.mariohans.cl${path}`;
  return {
    params: { id: "123" },
    url: new URL(href),
    request: new Request(href, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        cookie: "sb-access-token=valid-jwt",
      },
      body: JSON.stringify(body),
    }),
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  refreshSession.mockResolvedValue({
    data: {},
    error: { message: "Invalid Refresh Token" },
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

async function putAs(role: string, from: string, to: string) {
  stubRole(role);
  getOrderById.mockResolvedValue({ id: 123, status: from });
  updateOrderStatus.mockResolvedValue({ id: 123, status: to });
  const { PUT } = await import("../status");
  return PUT(context({ status: to }) as never);
}

describe("PUT /api/orders/[id]/status as operator", () => {
  it.each([
    ["confirmed", "preparation"],
    ["preparation", "in-rental"],
    ["in-rental", "return"],
  ])("lets the operator advance %s -> %s", async (from, to) => {
    const response = await putAs("operator", from, to);
    expect(response.status).toBe(200);
    expect(updateOrderStatus).toHaveBeenCalledWith(123, to);
  });

  it.each([
    ["return", "completed"],
    ["confirmed", "cancelled"],
    ["preparation", "cancelled"],
    ["preparation", "confirmed"],
    ["in-rental", "preparation"],
    ["confirmed", "in-rental"],
    ["evaluation", "confirmed"],
    ["request", "evaluation"],
  ])("denies the operator %s -> %s with 403 and no write", async (from, to) => {
    const response = await putAs("operator", from, to);
    const payload = await response.json();
    expect(response.status).toBe(403);
    expect(payload.success).toBe(false);
    expect(typeof payload.error).toBe("string");
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it("keeps admin behaviour intact: an admin may still complete and cancel", async () => {
    expect((await putAs("admin", "return", "completed")).status).toBe(200);
    expect((await putAs("super_admin", "confirmed", "cancelled")).status).toBe(
      200,
    );
  });
});

describe("PUT /api/orders/status/[id] alias as operator", () => {
  it("applies the same allowlist through the alias URL", async () => {
    stubRole("operator");
    getOrderById.mockResolvedValue({ id: 123, status: "return" });
    const { PUT } = await import("../../status/[id]");
    const response = await PUT(
      context({ status: "completed" }, "/api/orders/status/123") as never,
    );
    expect(response.status).toBe(403);
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });
});
