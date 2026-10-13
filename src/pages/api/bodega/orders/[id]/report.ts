import type { APIRoute } from "astro";
import { withAuth } from "../../../../../middleware/auth";
import { OrderLifecycleService } from "../../../../../services/orderLifecycleService";

/**
 * GET /api/bodega/orders/[id]/report — the return report saved by "Finalizar devolución"
 * (`orders.return_report`, migration 0018), read-only. `data: null` when there is none, or before
 * the migration. Shown in the admin order detail. CORS handled by global middleware.
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

export const GET: APIRoute = withAuth(async ({ params, locals, user }: any) => {
  const orderId = Number(params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return json({ success: false, error: "ID de orden inválido" }, 400);
  }

  try {
    const report = await OrderLifecycleService.getReturnReport(orderId);
    return json({ success: true, data: report }, 200);
  } catch (error) {
    console.error(
      "[GET /api/bodega/orders/:id/report] Error al leer el informe:",
      {
        orderId,
        userId: (user ?? locals?.user)?.id,
        error,
      },
    );
    return json(
      { success: false, error: "No se pudo cargar el informe de devolución" },
      500,
    );
  }
});
