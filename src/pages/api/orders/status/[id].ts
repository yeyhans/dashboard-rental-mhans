import type { APIRoute } from 'astro';
import { OrderService } from '../../../../services/orderService';
import { withAuth, withCors } from '../../../../middleware/auth';

export const PUT: APIRoute = withCors(withAuth(async (context) => {
  try {
    const orderId = parseInt(context.params.id as string);
    const { status, notes } = await context.request.json();

    if (isNaN(orderId)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de orden inválido'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    if (!status) {
      return new Response(JSON.stringify({
        success: false,
        error: 'El estado es requerido'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Validar estados permitidos
    const allowedStatuses = ['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed'];
    if (!allowedStatuses.includes(status)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Estado no válido'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const updatedOrder = await OrderService.updateOrderStatus(orderId, status, notes);

    return new Response(JSON.stringify({
      success: true,
      data: updatedOrder
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in PUT /api/orders/status/[id]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al actualizar el estado de la orden'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}));

export const OPTIONS: APIRoute = withCors(async () => {
  return new Response(null, { status: 200 });
});
