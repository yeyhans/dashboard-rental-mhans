import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * F7 (security hardening 2026-10-13). `POST /api/order/generate-contract-pdf` read any order with
 * the service-role key and could upload/email a contract PDF with no authentication at all. No
 * code path calls it (the frontend uses `/api/external/generate-contract-pdf` with `X-API-Key`),
 * so it now requires an admin session like the other order PDF routes.
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

const generatePdfBuffer = vi.fn();

vi.mock("../../../../lib/pdf/core/pdfService", () => ({ generatePdfBuffer }));

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

function context(options: { cookie?: string; body?: unknown } = {}) {
  const { cookie, body = {} } = options;
  const href = "https://dashboard.mariohans.cl/api/order/generate-contract-pdf";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cookie) headers.cookie = cookie;

  return {
    params: {},
    url: new URL(href),
    request: new Request(href, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  };
}

describe("POST /api/order/generate-contract-pdf", () => {
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

  it("rejects an unauthenticated request without reading any order", async () => {
    const { POST } = await import("../generate-contract-pdf");

    const response = await POST(
      context({ body: { order_id: 123, customer_id: 9 } }) as never,
    );

    expect(response.status).toBe(401);
    expect(adminFrom).not.toHaveBeenCalled();
    expect(generatePdfBuffer).not.toHaveBeenCalled();
  });

  it("rejects a forged X-API-Key header, which this route never accepted", async () => {
    const { POST } = await import("../generate-contract-pdf");
    const ctx = context({ body: { order_id: 123, customer_id: 9 } });
    ctx.request.headers.set("X-API-Key", "guess");

    const response = await POST(ctx as never);

    expect(response.status).toBe(401);
    expect(generatePdfBuffer).not.toHaveBeenCalled();
  });

  it("lets an admin session through to request validation", async () => {
    asAdmin();
    const { POST } = await import("../generate-contract-pdf");

    const response = await POST(
      context({ cookie: "sb-access-token=valid-jwt", body: {} }) as never,
    );

    expect(response.status).toBe(400);
    expect(generatePdfBuffer).not.toHaveBeenCalled();
  });
});
