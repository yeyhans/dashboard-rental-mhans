import type { APIRoute } from "astro";
import { canonicalStatus } from "../../../../lib/orderStatus";
import { checkStatusChange } from "../../../../lib/orderTransitionGate";
import { OrderService } from "../../../../services/orderService";
import { OrderLifecycleService } from "../../../../services/orderLifecycleService";
import { OrderPricingService } from "../../../../services/orderPricingService";
import { PricingError } from "../../../../lib/pricing";
import { validateReserveInput } from "../../../../lib/finance";
import { supabaseAdmin } from "../../../../lib/supabase";
import {
  FetchTimeoutError,
  fetchWithTimeout,
} from "../../../../lib/fetchWithTimeout";
import { createInternalApiHeaders } from "../../../../lib/serverApiAuth";
import { withAuth } from "../../../../middleware/auth";

// The email hop runs after the order is saved and itself waits on the mail worker. Without a
// deadline a slow hop froze the admin's tab (A-03); the worker call inside is bounded tighter.
const NOTIFICATION_TIMEOUT_MS = 20_000;
/** Several non-fatal problems in one save are all reported, never overwritten (H-2/H-3). */
function appendWarning(current: string | undefined, next: string): string {
  return current ? `${current} ${next}` : next;
}

const NOTIFICATION_WARNING =
  "La orden se guardó, pero no se pudo enviar el correo al cliente.";

export const PUT: APIRoute = withAuth(
  async ({ params, request, user, locals }: any) => {
    try {
      const orderId = params.id;

      if (!orderId || isNaN(Number(orderId))) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "ID de orden inválido",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const updateData = await request.json();

      // Get current order data BEFORE update (needed for email templates)
      const { data: currentOrder } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("id", Number(orderId))
        .single();

      if (!currentOrder) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Orden no encontrada",
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const previousStatus = currentOrder.status;
      const newStatus = updateData.status;

      // Same state machine as `PUT /api/orders/[id]/status` (T-02). Re-sending the current status
      // is a no-op for the machine, so the edit form can save other fields untouched. Rows still
      // on the legacy vocabulary are not judged, for the same reason the status route skips them.
      const isStatusChange = Boolean(newStatus) && newStatus !== previousStatus;
      if (isStatusChange) {
        const rejection = checkStatusChange({
          from: previousStatus,
          to: newStatus,
          role: (user ?? locals?.user)?.role,
        });
        if (rejection) {
          return new Response(
            JSON.stringify({
              success: false,
              error: rejection.error,
              code: rejection.code,
            }),
            {
              status: rejection.status,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      }

      // Validate required fields and sanitize data
      const sanitizedData: any = {};

      // Basic order fields
      if (updateData.status) sanitizedData.status = updateData.status;
      if (updateData.customer_note !== undefined)
        sanitizedData.customer_note = updateData.customer_note;
      if (updateData.payment_method)
        sanitizedData.payment_method = updateData.payment_method;
      if (updateData.payment_method_title)
        sanitizedData.payment_method_title = updateData.payment_method_title;
      if (updateData.transaction_id !== undefined)
        sanitizedData.transaction_id = updateData.transaction_id;

      // Billing information
      if (updateData.billing_first_name !== undefined)
        sanitizedData.billing_first_name = updateData.billing_first_name;
      if (updateData.billing_last_name !== undefined)
        sanitizedData.billing_last_name = updateData.billing_last_name;
      if (updateData.billing_company !== undefined)
        sanitizedData.billing_company = updateData.billing_company;
      if (updateData.billing_address_1 !== undefined)
        sanitizedData.billing_address_1 = updateData.billing_address_1;
      if (updateData.billing_city !== undefined)
        sanitizedData.billing_city = updateData.billing_city;
      if (updateData.billing_email !== undefined)
        sanitizedData.billing_email = updateData.billing_email;
      if (updateData.billing_phone !== undefined)
        sanitizedData.billing_phone = updateData.billing_phone;

      // Project information
      if (updateData.order_proyecto !== undefined)
        sanitizedData.order_proyecto = updateData.order_proyecto;
      if (updateData.order_fecha_inicio !== undefined)
        sanitizedData.order_fecha_inicio = updateData.order_fecha_inicio;
      if (updateData.order_fecha_termino !== undefined)
        sanitizedData.order_fecha_termino = updateData.order_fecha_termino;
      if (updateData.num_jornadas !== undefined)
        sanitizedData.num_jornadas = Number(updateData.num_jornadas);
      if (updateData.company_rut !== undefined)
        sanitizedData.company_rut = updateData.company_rut;

      // Retirement information
      if (updateData.order_retire_name !== undefined)
        sanitizedData.order_retire_name = updateData.order_retire_name;
      if (updateData.order_retire_phone !== undefined)
        sanitizedData.order_retire_phone = updateData.order_retire_phone;
      if (updateData.order_retire_rut !== undefined)
        sanitizedData.order_retire_rut = updateData.order_retire_rut;
      if (updateData.order_comments !== undefined)
        sanitizedData.order_comments = updateData.order_comments;

      // Montos: el servidor los recalcula desde la orden guardada + el cambio (ítems, fechas, envío,
      // cupón, descuento, IVA). Los calculated_* que manda el cliente se ignoran. `total` (legacy
      // WooCommerce) queda sincronizado con calculated_total dentro del servicio.
      if (updateData.coupon_lines !== undefined)
        sanitizedData.coupon_lines = updateData.coupon_lines;
      try {
        const pricedFields = await OrderPricingService.priceOrderUpdate(
          currentOrder,
          updateData,
        );
        if (pricedFields) Object.assign(sanitizedData, pricedFields);
      } catch (pricingError) {
        if (pricingError instanceof PricingError) {
          console.error("[PUT /api/orders/update] Montos inválidos:", {
            orderId,
            error: pricingError.message,
          });
          return new Response(
            JSON.stringify({ success: false, error: pricingError.message }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        throw pricingError;
      }

      // Status flags
      if (updateData.correo_enviado !== undefined)
        sanitizedData.correo_enviado = Boolean(updateData.correo_enviado);
      if (updateData.pago_reserva !== undefined) {
        if (typeof updateData.pago_reserva === "string") {
          sanitizedData.pago_reserva = updateData.pago_reserva === "true";
        } else {
          sanitizedData.pago_reserva = Boolean(updateData.pago_reserva);
        }
      }
      if (updateData.pago_completo !== undefined) {
        // Handle both boolean and string values
        if (typeof updateData.pago_completo === "string") {
          sanitizedData.pago_completo = updateData.pago_completo === "true";
        } else {
          sanitizedData.pago_completo = Boolean(updateData.pago_completo);
        }
      }
      // Invariante de negocio: pago completo implica reserva pagada
      if (sanitizedData.pago_completo === true) {
        sanitizedData.pago_reserva = true;
      }

      // Line items (JSON field)
      if (updateData.line_items !== undefined) {
        sanitizedData.line_items = Array.isArray(updateData.line_items)
          ? updateData.line_items
          : JSON.parse(updateData.line_items);
      }

      // Reserve configuration (`orders.reserve_type` / `reserve_value`, migración 0008).
      //
      // Se valida el PAR completo y se rechaza con 400 en español. Antes, un valor fuera de rango
      // se descartaba en silencio —el admin creía haber guardado— y un porcentaje mayor a 100 se
      // enviaba tal cual a la base, donde la CHECK de 0008 lo rechaza con un error interno que
      // llegaba al panel como un 500. `ProcessOrder.tsx:579` ya topaba el 100 en el cliente, pero
      // esa validación es sólo UX: la del servidor es la que manda.
      const reserveError = validateReserveInput(updateData);
      if (reserveError) {
        return new Response(
          JSON.stringify({ success: false, error: reserveError }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      if (updateData.reserve_type !== undefined) {
        sanitizedData.reserve_type = updateData.reserve_type;
        sanitizedData.reserve_value = Number(updateData.reserve_value);
      }

      // Document URLs
      if (updateData.orden_compra !== undefined)
        sanitizedData.orden_compra = updateData.orden_compra;
      if (updateData.numero_factura !== undefined)
        sanitizedData.numero_factura = updateData.numero_factura;

      // Update modification date
      sanitizedData.date_modified = new Date().toISOString();

      // If status is being changed to completed, set completion date
      if (
        canonicalStatus(updateData.status) === "completed" &&
        !sanitizedData.date_completed
      ) {
        sanitizedData.date_completed = new Date().toISOString();
      }

      // Se compara el estado normalizado, no el literal. `failed` desaparece en 0003 plegado sobre
      // `cancelled`: comparar contra `'failed'` haria que el correo de disculpas dejara de salir
      // justo cuando el pedido no prospera, que es cuando mas importa.
      const nuevoCanonico = canonicalStatus(newStatus);
      const anteriorCanonico = canonicalStatus(previousStatus);
      const notificationTarget =
        nuevoCanonico === "completed" && anteriorCanonico !== "completed"
          ? {
              path: "/api/emails/send-order-completed-notification",
              emailType: "order_completed",
            }
          : nuevoCanonico === "cancelled" && anteriorCanonico !== "cancelled"
            ? {
                path: "/api/emails/send-order-failed-notification",
                emailType: "order_failed",
              }
            : null;

      console.log("Updating order with data:", sanitizedData);

      // The status change is saved FIRST. The customer email is best effort: if it fails or times out
      // the order stays saved and the response carries a non-fatal warning (D-9).
      // R-05: `orders.discount_percent` arrives with migration 0019. Until it is applied, the
      // order is saved without it (the recomputed `calculated_discount` still lands) and the
      // response says so, instead of the whole edit failing on one missing column.
      let discountPercentWarning: string | undefined;
      let updatedOrder;
      try {
        updatedOrder = await OrderService.updateOrder(
          Number(orderId),
          sanitizedData,
        );
      } catch (saveError) {
        const code = (saveError as { code?: string } | null)?.code;
        const missingColumn = code === "42703" || code === "PGRST204";
        if (!missingColumn || !("discount_percent" in sanitizedData)) {
          throw saveError;
        }
        console.error(
          "[PUT /api/orders/update/:id] orders.discount_percent no existe (migración 0019 pendiente):",
          { orderId },
        );
        delete sanitizedData.discount_percent;
        updatedOrder = await OrderService.updateOrder(
          Number(orderId),
          sanitizedData,
        );
        discountPercentWarning =
          "La orden se guardó con el monto del descuento, pero el porcentaje no: falta aplicar la migración 0019.";
      }

      let warning: string | undefined = discountPercentWarning;
      if (notificationTarget) {
        const notificationOrder = { ...currentOrder, ...sanitizedData };
        const notificationUrl = new URL(
          notificationTarget.path,
          request.url,
        ).toString();
        console.log(
          "📧 [Order Update] Status changed, sending notification email...",
          {
            orderId,
            newStatus,
            notificationUrl,
          },
        );

        try {
          const notificationResponse = await fetchWithTimeout(
            notificationUrl,
            {
              method: "POST",
              headers: createInternalApiHeaders(crypto.randomUUID()),
              body: JSON.stringify({
                orderData: notificationOrder,
                emailType: notificationTarget.emailType,
              }),
            },
            NOTIFICATION_TIMEOUT_MS,
          );

          if (!notificationResponse.ok) {
            const errorText = await notificationResponse.text().catch(() => "");
            console.error(
              "❌ [Order Update] Notification email failed (order already saved):",
              {
                orderId,
                newStatus,
                status: notificationResponse.status,
                error: errorText,
              },
            );
            warning = appendWarning(warning, NOTIFICATION_WARNING);
          } else {
            console.log(
              "✅ [Order Update] Notification email sent successfully",
            );
          }
        } catch (notificationError) {
          console.error(
            "❌ [Order Update] Notification email did not go out (order already saved):",
            {
              orderId,
              newStatus,
              timedOut: notificationError instanceof FetchTimeoutError,
              error:
                notificationError instanceof Error
                  ? notificationError.message
                  : notificationError,
            },
          );
          warning = appendWarning(warning, NOTIFICATION_WARNING);
        }
      }

      // R-14: same lifecycle side effects as the status route (contract on `in-rental`). The
      // order is already saved; the service never throws and only reports a warning, which is
      // added to (never replaces) the email warning (H-2).
      //
      // It runs inside the request on purpose: the contract render is bounded by
      // `CONTRACT_GENERATION_TIMEOUT_MS` (20 s), and no `waitUntil` is wired in this project (no
      // `@vercel/functions` dependency): on serverless, work started after the response is sent
      // can be frozen mid-upload. Deferring it is a follow-up, not a silent change.
      if (isStatusChange) {
        const lifecycle = await OrderLifecycleService.onStatusChanged(
          updatedOrder,
          String(newStatus),
        );
        if (lifecycle.warning) {
          warning = appendWarning(warning, lifecycle.warning);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Orden actualizada correctamente",
          data: updatedOrder,
          ...(warning ? { warning } : {}),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      // El detalle interno (columnas, mensajes de Postgres) se queda en el log del servidor; al
      // panel sólo llega un mensaje genérico en español, como en `PUT /api/orders/:id`.
      console.error(
        "[PUT /api/orders/update/:id] Error al actualizar la orden:",
        {
          orderId: params.id,
          error,
        },
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: "Error al actualizar la orden",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  },
);

export const PATCH: APIRoute = async (context) => {
  // PATCH method for partial updates
  return PUT(context);
};
