import type { APIRoute } from "astro";
import { withAuth } from "../../../middleware/auth";
import { OrderLifecycleService } from "../../../services/orderLifecycleService";

/**
 * (Re)generates an order's processing PDF — the per-order contract — and stores its URL in
 * `orders.new_pdf_processing_url`. Called from the "Generar contrato" button in `ProcessOrder`.
 *
 * This route used to be unauthenticated and wrote `orders` with the service role; it also kept
 * its own copy of the render/upload steps, which fell back to storing nothing but returning a
 * base64 data URL when R2 failed. It now requires an admin session and delegates to
 * `OrderLifecycleService.generateRentalContract`, the same generator the `in-rental` transition
 * uses (bounded by a deadline, never stores a data URL).
 */

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = withAuth(
  async ({ request, locals, user }: any) => {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return json({ success: false, error: "JSON inválido" }, 400);
    }

    // Both shapes stay accepted: `{ order_id }` and the legacy `{ orderData: { order_id | id } }`.
    const rawId =
      body?.order_id ?? body?.orderData?.order_id ?? body?.orderData?.id;
    const orderId = Number.parseInt(String(rawId), 10);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return json({ success: false, error: "ID de orden inválido" }, 400);
    }

    try {
      const pdfUrl =
        await OrderLifecycleService.generateRentalContract(orderId);
      return json(
        {
          success: true,
          message: "PDF de procesamiento generado exitosamente",
          data: { order_id: orderId, pdf_url: pdfUrl },
          pdf_url: pdfUrl,
          pdfUrl,
        },
        200,
      );
    } catch (error) {
      console.error(
        "[POST /api/order/generate-processing-pdf] Error al generar el contrato:",
        { orderId, adminId: (user ?? locals?.user)?.id, error },
      );
      return json(
        { success: false, error: "No se pudo generar el contrato de la orden" },
        500,
      );
    }
  },
);
