import type { APIRoute } from "astro";
import {
  checkStatusChange,
  openCheckoutsRejection,
  parseStatusChangeOptions,
  requiresOpenCheckoutCheck,
} from "../../../../lib/orderTransitionGate";
import { withAuth } from "../../../../middleware/auth";
import { OrderService } from "../../../../services/orderService";
import { OrderLifecycleService } from "../../../../services/orderLifecycleService";
import { ORDER_STATUSES, isOrderStatus } from "../../../../lib/orderStatus";

/**
 * The accepted values come from `src/lib/orderStatus.ts`, which mirrors the `orders_status_check`
 * constraint. Previously this route kept its own hand-written list — one of 29 copies of the
 * vocabulary in `src/` — so the v1.2 migration would have needed 29 correct edits to land.
 *
 * Rejecting here rather than letting Postgres do it is deliberate: after 0003 the database refuses
 * `on-hold`, but as a constraint violation this route turns into a 500. A 400 naming the accepted
 * values tells an admin on a stale page what actually went wrong.
 */

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Asset tags still checked out to the order. The inventory service is loaded lazily and any
 * failure reads as "nothing out": this guard must never take a status change down with it.
 */
async function listOpenCheckouts(orderId: number): Promise<string[]> {
  try {
    const { AssetMovementService } = await import(
      "../../../../services/assetMovementService"
    );
    return await AssetMovementService.listOpenCheckoutsForOrder(orderId);
  } catch (error) {
    console.error(
      "[PUT /api/orders/[id]/status] No se pudieron revisar las unidades sin devolver:",
      { orderId, error },
    );
    return [];
  }
}

/**
 * Was an unauthenticated route writing `orders.status` through the anon client. Migration 0001
 * revokes anon UPDATE on `orders`, and the missing gate let anyone move an order to `completed`.
 */
export const PUT: APIRoute = withAuth(async (context) => {
  const orderId = parseInt(String(context.params.id), 10);
  if (Number.isNaN(orderId) || orderId <= 0) {
    return json({ success: false, error: "ID de orden inválido" }, 400);
  }

  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return json({ success: false, error: "JSON inválido" }, 400);
  }

  if (!body?.status) {
    return json({ success: false, error: "El estado es requerido" }, 400);
  }

  if (!isOrderStatus(body.status)) {
    return json(
      {
        success: false,
        error: `Estado inválido. Debe ser uno de: ${ORDER_STATUSES.join(", ")}`,
      },
      400,
    );
  }

  const options = parseStatusChangeOptions(body);
  if ("error" in options) {
    return json({ success: false, error: options.error }, 400);
  }

  // Máquina de estados (Área 01 §5 `TRANSICIONES_VALIDAS`). La validación de vocabulario de arriba
  // responde "¿existe este estado?"; esta responde "¿es un movimiento legal desde donde está?".
  // Son fallos distintos: el primero es un cliente desactualizado, el segundo es un clic desde la
  // etapa equivocada — y es el peligroso, porque así una orden llega a `in-rental` sin que nadie
  // haya asignado unidades por número de serie en `preparation`, y nada aguas abajo lo detecta.
  let current;
  try {
    current = await OrderService.getOrderById(orderId);
  } catch (error) {
    console.error("[PUT /api/orders/[id]/status] Error al leer la orden:", {
      orderId,
      adminId: context.user?.id,
      error,
    });
    return json(
      { success: false, error: "Error al actualizar el estado de la orden" },
      500,
    );
  }

  if (!current) {
    return json({ success: false, error: "La orden no existe" }, 404);
  }

  // Operator allowlist + state machine, shared with `PUT /api/orders/update/[id]`
  // (`lib/orderTransitionGate.ts`). A legacy origin is not judged there either.
  const rejection = checkStatusChange({
    from: current.status,
    to: body.status,
    role: context.user?.role,
  });
  if (rejection) {
    return json(
      { success: false, error: rejection.error, code: rejection.code },
      rejection.status,
    );
  }

  // Closing the order, or sending it back from the rental, while serialised units are still out
  // leaves them marked "out" against an order that no longer expects them: ask first.
  if (
    !options.acknowledgeOpenCheckouts &&
    requiresOpenCheckoutCheck(current.status, body.status)
  ) {
    const assetTags = await listOpenCheckouts(orderId);
    if (assetTags.length > 0) {
      return json(openCheckoutsRejection(assetTags), 409);
    }
  }

  let order;
  try {
    // `reason` only lands when cancelling, as `cancellation_reason`. The `notes` parameter of
    // updateOrderStatus writes `customer_note`, which belongs to the customer, not the admin.
    order =
      body.status === "cancelled" && options.reason
        ? await OrderService.updateOrderStatus(orderId, body.status, undefined, {
            cancellationReason: options.reason,
          })
        : await OrderService.updateOrderStatus(orderId, body.status);
  } catch (error) {
    console.error("[PUT /api/orders/[id]/status] Error:", {
      orderId,
      status: body.status,
      adminId: context.user?.id,
      error,
    });
    return json(
      { success: false, error: "Error al actualizar el estado de la orden" },
      500,
    );
  }

  // R-14: side effects of the new stage (contract on `in-rental`). The status is already saved,
  // so a failure here only adds a warning; it never turns the change into an error.
  // R-09c: `previousStatus` lets the lifecycle send the one customer email of this transition.
  // An admin jump only emails the customer when the admin ticked "Notificar al cliente".
  const lifecycle = await OrderLifecycleService.onStatusChanged(
    order,
    body.status,
    {
      previousStatus: current.status,
      ...(options.notify ? { notify: true } : {}),
    },
  );

  return json(
    {
      success: true,
      data: order,
      message: `Estado de la orden actualizado a ${body.status}`,
      ...(lifecycle.warning ? { warning: lifecycle.warning } : {}),
    },
    200,
  );
});
