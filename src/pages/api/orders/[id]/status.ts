import type { APIRoute } from 'astro';
import { withAuth } from '../../../../middleware/auth';
import { OrderService } from '../../../../services/orderService';

/**
 * Values accepted by the `orders_status_check` constraint. The previous list also carried
 * `trash` and `auto-draft`, which the database rejects — those turned a bad request into a 500.
 */
const VALID_STATUSES = [
  'pending',
  'processing',
  'on-hold',
  'completed',
  'cancelled',
  'refunded',
  'failed',
];

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

  if (!VALID_STATUSES.includes(body.status)) {
    return json(
      { success: false, error: `Estado inválido. Debe ser uno de: ${VALID_STATUSES.join(', ')}` },
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
