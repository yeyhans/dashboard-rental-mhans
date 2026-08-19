import type { APIRoute } from 'astro';
import { withAuth } from '../../../../middleware/auth';
import { OrderService } from '../../../../services/orderService';
import { ORDER_STATUSES, isOrderStatus } from '../../../../lib/orderStatus';

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
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Was an unauthenticated route writing `orders.status` through the anon client. Migration 0001
 * revokes anon UPDATE on `orders`, and the missing gate let anyone move an order to `completed`.
 */
export const PUT: APIRoute = withAuth(async (context) => {
  const orderId = parseInt(String(context.params.id), 10);
  if (Number.isNaN(orderId) || orderId <= 0) {
    return json({ success: false, error: 'ID de orden inválido' }, 400);
  }

  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return json({ success: false, error: 'JSON inválido' }, 400);
  }

  if (!body?.status) {
    return json({ success: false, error: 'El estado es requerido' }, 400);
  }

  if (!isOrderStatus(body.status)) {
    return json(
      { success: false, error: `Estado inválido. Debe ser uno de: ${ORDER_STATUSES.join(', ')}` },
      400
    );
  }

  try {
    // `reason` sigue sin persistirse a propósito: el parámetro `notes` de updateOrderStatus
    // escribe en `customer_note`, que pertenece al cliente, no al admin.
    const order = await OrderService.updateOrderStatus(orderId, body.status);

    return json(
      { success: true, data: order, message: `Estado de la orden actualizado a ${body.status}` },
      200
    );
  } catch (error) {
    console.error('[PUT /api/orders/[id]/status] Error:', {
      orderId,
      status: body.status,
      adminId: context.user?.id,
      error,
    });
    return json({ success: false, error: 'Error al actualizar el estado de la orden' }, 500);
  }
});
