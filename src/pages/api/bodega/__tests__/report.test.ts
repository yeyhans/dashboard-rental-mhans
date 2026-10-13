import { afterEach, describe, expect, it, vi } from "vitest";

/** R-04b: `GET /api/bodega/orders/[id]/report` — the saved return report, read-only. */
const getReturnReport = vi.hoisted(() => vi.fn());

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

vi.mock("../../../../services/orderLifecycleService", () => ({
  OrderLifecycleService: { getReturnReport },
}));

const { GET } = await import("../orders/[id]/report");

function ctx(id: string, user: unknown = { id: "a-1", role: "admin" }) {
  return {
    params: { id },
    request: new Request(
      `https://dash.example.cl/api/bodega/orders/${id}/report`,
    ),
    locals: user ? { user } : {},
  } as never;
}

describe("GET /api/bodega/orders/[id]/report", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an unauthenticated caller", async () => {
    expect((await GET(ctx("7", null))).status).toBe(401);
  });

  it("answers 400 for an invalid id", async () => {
    expect((await GET(ctx("x"))).status).toBe(400);
  });

  it("returns the report, or null when there is none", async () => {
    getReturnReport.mockResolvedValueOnce({ lines: [] });
    await expect((await GET(ctx("7"))).json()).resolves.toEqual({
      success: true,
      data: { lines: [] },
    });

    getReturnReport.mockResolvedValueOnce(null);
    await expect((await GET(ctx("7"))).json()).resolves.toEqual({
      success: true,
      data: null,
    });
  });

  it("hides a database error behind a generic 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getReturnReport.mockRejectedValueOnce(new Error("secret"));
    const response = await GET(ctx("7"));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});
