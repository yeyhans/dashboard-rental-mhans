import type { APIRoute } from 'astro';
import { OrderItemService } from '../../../../services/orderItemService';
import { withAuth, withCors } from '../../../../middleware/auth';

export const GET: APIRoute = withCors(withAuth(async (context) => {
  try {
    const itemId = parseInt(context.params.id as string);

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

    const item = await OrderItemService.getOrderItemById(itemId);

    if (!item) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Item no encontrado'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: item
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in GET /api/order-items/item/[id]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al obtener el item'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}));

export const PUT: APIRoute = withCors(withAuth(async (context) => {
  try {
    const itemId = parseInt(context.params.id as string);
    const updates = await context.request.json();

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

    // Verificar que el item existe
    const existingItem = await OrderItemService.getOrderItemById(itemId);
    if (!existingItem) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Item no encontrado'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Si se está actualizando la cantidad, validar stock
    if (updates.quantity && updates.quantity !== existingItem.quantity) {
      const hasStock = await OrderItemService.validateStock(existingItem.product_id, updates.quantity);
      if (!hasStock) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Stock insuficiente para la cantidad solicitada'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

      // Recalcular total si se actualiza cantidad
      updates.total = existingItem.product_price * updates.quantity;
    }

    const updatedItem = await OrderItemService.updateOrderItem(itemId, updates);

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
    console.error('Error in PUT /api/order-items/item/[id]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al actualizar el item'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}));

export const DELETE: APIRoute = withCors(withAuth(async (context) => {
  try {
    const itemId = parseInt(context.params.id as string);

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

    // Verificar que el item existe
    const existingItem = await OrderItemService.getOrderItemById(itemId);
    if (!existingItem) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Item no encontrado'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    await OrderItemService.deleteOrderItem(itemId);

    return new Response(JSON.stringify({
      success: true,
      message: 'Item eliminado correctamente'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in DELETE /api/order-items/item/[id]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al eliminar el item'
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
