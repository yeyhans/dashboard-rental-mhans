import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * F1 (security hardening 2026-10-13). `PUT /api/orders/[id]/warranty-photos` wrote
 * `orders.fotos_garantia` through `OrderService` (service role) with no `withAuth`, so anyone on
 * the internet could overwrite an order's warranty photos. Its only caller is the dashboard's
 * `WarrantyPhotosService`, a same-origin fetch that carries the admin session cookie.
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

const updateWarrantyPhotos = vi.fn();

vi.mock("../../../../../services/orderService", () => ({
  OrderService: { updateWarrantyPhotos },
}));

function asAdmin() {
  authGetUser.mockResolvedValue({
    data: { user: { id: "admin-1", email: "admin@x.cl" } },
    error: null,
  });
  adminFrom.mockReturnValue({
    select: () => ({
      eq: () => ({
        in: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: 1,
                user_id: "admin-1",
                email: "admin@x.cl",
                role: "admin",
              },
              error: null,
            }),
        }),
      }),
    }),
  });
}

function context(
  options: { cookie?: string; body?: unknown; id?: string } = {},
) {
  const { cookie, body = {}, id = "123" } = options;
  const href = `https://dashboard.mariohans.cl/api/orders/${id}/warranty-photos`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cookie) headers.cookie = cookie;

  return {
    params: { id },
    url: new URL(href),
    request: new Request(href, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    }),
  };
}

const validBody = {
  photoUrls: ["https://files.mariohans.cl/warranty/123/a.jpg"],
};

describe("PUT /api/orders/[id]/warranty-photos", () => {
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

  it("rejects an unauthenticated request without writing the order", async () => {
    const { PUT } = await import("../warranty-photos");

    const response = await PUT(context({ body: validBody }) as never);

    expect(response.status).toBe(401);
    expect(updateWarrantyPhotos).not.toHaveBeenCalled();
  });

  it("rejects a session that is not an admin", async () => {
    authGetUser.mockResolvedValue({
      data: { user: { id: "customer-1", email: "c@x.cl" } },
      error: null,
    });
    adminFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          in: () => ({
            single: () =>
              Promise.resolve({ data: null, error: { code: "PGRST116" } }),
          }),
        }),
      }),
    });
    const { PUT } = await import("../warranty-photos");

    const response = await PUT(
      context({
        cookie: "sb-access-token=customer-jwt",
        body: validBody,
      }) as never,
    );

    expect(response.status).toBe(401);
    expect(updateWarrantyPhotos).not.toHaveBeenCalled();
  });

  it("updates the warranty photos for an admin session", async () => {
    asAdmin();
    updateWarrantyPhotos.mockResolvedValue({
      id: 123,
      fotos_garantia: validBody.photoUrls,
    });
    const { PUT } = await import("../warranty-photos");

    const response = await PUT(
      context({
        cookie: "sb-access-token=valid-jwt",
        body: validBody,
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(updateWarrantyPhotos).toHaveBeenCalledWith(123, validBody.photoUrls);
  });

  it("rejects non-HTTPS photo URLs for an admin session", async () => {
    asAdmin();
    const { PUT } = await import("../warranty-photos");

    const response = await PUT(
      context({
        cookie: "sb-access-token=valid-jwt",
        body: { photoUrls: ["http://evil.example/x.jpg"] },
      }) as never,
    );

    expect(response.status).toBe(400);
    expect(updateWarrantyPhotos).not.toHaveBeenCalled();
  });

  it("no longer advertises a wildcard CORS preflight", async () => {
    const mod = await import("../warranty-photos");

    expect((mod as Record<string, unknown>).OPTIONS).toBeUndefined();
  });
});
