import type { APIRoute } from 'astro';
import { OrderItemService } from '../../../../services/orderItemService';
import { withAuth, withCors } from '../../../../middleware/auth';

export const PUT: APIRoute = withCors(withAuth(async (context) => {
  try {
    const itemId = parseInt(context.params.id as string);
    const { quantity } = await context.request.json();

    if (isNaN(itemId)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de item inválido'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    if (!quantity || quantity <= 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'La cantidad debe ser mayor a 0'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const updatedItem = await OrderItemService.updateItemQuantity(itemId, quantity);

    return new Response(JSON.stringify({
      success: true,
      data: updatedItem
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in PUT /api/order-items/quantity/[id]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar la cantidad del item'
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
