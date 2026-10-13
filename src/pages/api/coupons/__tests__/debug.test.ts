import { afterEach, describe, expect, it, vi } from "vitest";

const from = vi.fn();

vi.mock("../../../../middleware/auth", () => ({
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

vi.mock("../../../../lib/supabase", () => ({
  supabaseAdmin: { from },
}));

const adminLocals = { user: { id: "admin-1", role: "admin" } };

/**
 * T-12: the coupon diagnostic is a development aid. Outside a dev build it must not exist,
 * even for a signed-in admin.
 */
describe("GET /api/coupons/debug (T-12)", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("answers 404 in a production build, before any coupon query", async () => {
    vi.stubEnv("DEV", false);
    const { GET } = await import("../debug");
    const request = new Request(
      "https://dashboard.mariohans.cl/api/coupons/debug",
    );

    const response = await GET({ request, locals: adminLocals } as never);

    expect(response.status).toBe(404);
    expect(from).not.toHaveBeenCalled();
  });

  it("still requires a session in development", async () => {
    vi.stubEnv("DEV", true);
    const { GET } = await import("../debug");
    const request = new Request(
      "https://dashboard.mariohans.cl/api/coupons/debug",
    );

    const response = await GET({ request, locals: {} } as never);

    expect(response.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
});
