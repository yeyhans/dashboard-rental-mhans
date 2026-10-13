import type { APIRoute } from "astro";
import { withAuth } from "../../../../../middleware/auth";
import {
  OrderLifecycleService,
  ReturnFinalizeError,
} from "../../../../../services/orderLifecycleService";

/**
 * POST /api/bodega/orders/[id]/finalize — closes a return (R-04b).
 *
 * The one route behind "Finalizar devolución" in the shared reception panel, on /check-in
 * (admins) and /bodega (operators). Under `/api/bodega` because that prefix is already reachable
 * by operators (`lib/accessControl.ts`), so no access rule is widened. Body: `{ lines }`, the
 * panel's report. All rules — report validation, which states can close, the due date, the
 * operator gate — live in `OrderLifecycleService.finalizeReturn`; this route maps its refusals
 * to statuses and shows their Spanish as-is. CORS handled by global middleware.
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

export const POST: APIRoute = withAuth(
  async ({ params, request, locals, user }: any) => {
    const orderId = Number(params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return json({ success: false, error: "ID de orden inválido" }, 400);
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return json({ success: false, error: "JSON inválido" }, 400);
    }

    const actor = user ?? locals?.user;
    try {
      const result = await OrderLifecycleService.finalizeReturn({
        orderId,
        role: actor?.role ?? null,
        actorId: actor?.id ?? null,
        lines: body?.lines,
      });
      const order = result.order as { status?: string } | null;
      return json(
        {
          success: true,
          data: { steps: result.steps, status: order?.status ?? "completed" },
          ...(result.warning ? { warning: result.warning } : {}),
        },
        200,
      );
    } catch (error) {
      if (error instanceof ReturnFinalizeError) {
        return json(
          {
            success: false,
            error: error.message,
            ...(error.code ? { code: error.code } : {}),
          },
          error.status,
        );
      }
      console.error(
        "[POST /api/bodega/orders/:id/finalize] Error al cerrar la devolución:",
        {
          orderId,
          userId: actor?.id,
          error,
        },
      );
      return json(
        {
          success: false,
          error: "No se pudo cerrar la devolución. Inténtalo de nuevo.",
        },
        500,
      );
    }
  },
);
