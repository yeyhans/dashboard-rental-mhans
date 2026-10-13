import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * R-04b: `POST /api/bodega/orders/[id]/finalize` — the one route that closes a return, used by
 * the shared reception panel on /check-in and /bodega. It lives under `/api/bodega` because that
 * prefix is already operator-reachable (`lib/accessControl.ts`); no access rule was widened.
 */
const finalizeReturn = vi.hoisted(() => vi.fn());

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

vi.mock("../../../../services/orderLifecycleService", async () => {
  class ReturnFinalizeError extends Error {
    constructor(
      readonly status: number,
      message: string,
      readonly code?: string,
    ) {
      super(message);
    }
  }
  return { OrderLifecycleService: { finalizeReturn }, ReturnFinalizeError };
});

const { ReturnFinalizeError } = await import(
  "../../../../services/orderLifecycleService"
);
const { POST } = await import("../orders/[id]/finalize");

const LINES = [{ key: "0", label: "Cámara", state: "received" }];

function ctx(
  id: string,
  body: unknown,
  user: unknown = { id: "op-1", role: "operator" },
) {
  return {
    params: { id },
    request: new Request(
      `https://dash.example.cl/api/bodega/orders/${id}/finalize`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    ),
    locals: user ? { user } : {},
  } as never;
}

describe("POST /api/bodega/orders/[id]/finalize", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an unauthenticated caller (401)", async () => {
    const response = await POST(ctx("7", { lines: LINES }, null));
    expect(response.status).toBe(401);
    expect(finalizeReturn).not.toHaveBeenCalled();
  });

  it("answers 400 for an invalid order id", async () => {
    const response = await POST(ctx("abc", { lines: LINES }));
    expect(response.status).toBe(400);
  });

  it("lets an operator close a return, passing role and actor to the service", async () => {
    finalizeReturn.mockResolvedValue({
      steps: ["completed"],
      order: { id: 7, status: "completed" },
    });

    const response = await POST(ctx("7", { lines: LINES }));

    expect(response.status).toBe(200);
    expect(finalizeReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 7,
        role: "operator",
        actorId: "op-1",
        lines: LINES,
      }),
    );
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { steps: ["completed"], status: "completed" },
    });
  });

  it("carries the service warning (missing migration) in a 200", async () => {
    finalizeReturn.mockResolvedValue({
      steps: ["completed"],
      order: { id: 7, status: "completed" },
      warning: "falta aplicar la migración 0018",
    });

    const response = await POST(ctx("7", { lines: LINES }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.warning).toContain("0018");
  });

  it("maps a wrong state to 409 with the service's message", async () => {
    finalizeReturn.mockRejectedValue(
      new ReturnFinalizeError(
        409,
        "El arriendo aún no termina",
        "RETURN_NOT_DUE",
      ),
    );

    const response = await POST(ctx("7", { lines: LINES }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "El arriendo aún no termina",
      code: "RETURN_NOT_DUE",
    });
  });

  it("maps a forbidden operator step to 403", async () => {
    finalizeReturn.mockRejectedValue(
      new ReturnFinalizeError(
        403,
        "Como operario…",
        "OPERATOR_TRANSITION_FORBIDDEN",
      ),
    );
    expect((await POST(ctx("7", { lines: LINES }))).status).toBe(403);
  });

  it("hides unexpected errors behind a generic 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    finalizeReturn.mockRejectedValue(new Error("relation secret"));

    const response = await POST(ctx("7", { lines: LINES }));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});
