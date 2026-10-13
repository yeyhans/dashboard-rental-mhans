import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * R-03a: `PATCH /api/payments/[id]` — behind the Pago select and the OC / Factura inputs of
 * Finanzas & Cobranza. Admin-only: `/api/payments` is not an operator prefix in
 * `lib/accessControl.ts`.
 */
const updatePayment = vi.hoisted(() => vi.fn());

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

vi.mock("../../../../services/financeService", () => ({
  FinanceService: { updatePayment },
}));

const { PATCH } = await import("../[id]");

function ctx(id: string, body: unknown, user: unknown = { id: "a-1" }) {
  return {
    params: { id },
    request: new Request(`https://dash.example.cl/api/payments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    locals: user ? { user } : {},
  } as never;
}

beforeEach(() => {
  updatePayment.mockReset();
});

describe("PATCH /api/payments/[id]", () => {
  it("requires an admin session", async () => {
    const res = await PATCH(ctx("7", { paid: true }, null));
    expect(res.status).toBe(401);
    expect(updatePayment).not.toHaveBeenCalled();
  });

  it("rejects an invalid id", async () => {
    const res = await PATCH(ctx("abc", { paid: true }));
    expect(res.status).toBe(400);
    expect(updatePayment).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const res = await PATCH(ctx("7", "{nope"));
    expect(res.status).toBe(400);
  });

  it("answers the validation error in Spanish", async () => {
    const res = await PATCH(ctx("7", { paid: "yes" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toMatchObject({ success: false });
    expect(body.error).toMatch(/estado de pago/i);
    expect(updatePayment).not.toHaveBeenCalled();
  });

  it("answers 404 when the order does not exist", async () => {
    updatePayment.mockResolvedValue(null);
    const res = await PATCH(ctx("7", { paid: true }));
    expect(res.status).toBe(404);
  });

  it("saves and returns the new payment state", async () => {
    const saved = {
      id: 7,
      fullyPaid: true,
      reservePaid: true,
      paidAt: "2026-10-13T15:00:00.000Z",
      purchaseOrder: null,
      invoiceNumber: null,
    };
    updatePayment.mockResolvedValue(saved);

    const res = await PATCH(ctx("7", { paid: true }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: saved });
    expect(updatePayment).toHaveBeenCalledWith(
      7,
      { paid: true },
      expect.any(Date),
    );
  });

  it("hides the database error behind a generic message", async () => {
    updatePayment.mockRejectedValue({ message: "relation secret" });
    const res = await PATCH(ctx("7", { invoiceNumber: "F-9" }));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("secret");
  });
});
