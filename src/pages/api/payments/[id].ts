import type { APIRoute } from "astro";
import { withAuth } from "../../../middleware/auth";
import { validatePaymentUpdate } from "../../../lib/finance";
import { FinanceService } from "../../../services/financeService";

/**
 * PATCH /api/payments/[id] — the Pago select and the OC / Factura inputs of Finanzas & Cobranza
 * (R-03a).
 *
 * Body: any of `{ paid: boolean, purchaseOrder: string | null, invoiceNumber: string | null }`.
 * Only those fields are read, so this route cannot move an order's status or totals. Admin-only:
 * `/api/payments` is not an operator prefix in `lib/accessControl.ts`. CORS handled by global
 * middleware.
 */
function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export const PATCH: APIRoute = withAuth(
  async ({ params, request, locals, user }: any) => {
    const orderId = Number(params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return json({ success: false, error: "ID de pedido inválido" }, 400);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ success: false, error: "JSON inválido" }, 400);
    }

    const validation = validatePaymentUpdate(body);
    if (!validation.ok) {
      return json({ success: false, error: validation.error }, 400);
    }

    const actor = user ?? locals?.user;
    try {
      const saved = await FinanceService.updatePayment(
        orderId,
        validation.update,
        new Date(),
      );
      if (!saved) {
        return json({ success: false, error: "Pedido no encontrado" }, 404);
      }
      return json({ success: true, data: saved }, 200);
    } catch (error) {
      console.error("[PATCH /api/payments/:id] Error al guardar el pago:", {
        orderId,
        userId: actor?.id,
        error,
      });
      return json({ success: false, error: "No se pudo guardar el pago" }, 500);
    }
  },
);
