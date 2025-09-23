import type { APIRoute } from 'astro';
import { OrderItemService } from '../../../services/orderItemService';
import { withAuth, withCors } from '../../../middleware/auth';

export const GET: APIRoute = withCors(withAuth(async (context) => {
  try {
    const orderId = parseInt(context.params.orderId as string);

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

    const items = await OrderItemService.getOrderItems(orderId);

    return new Response(JSON.stringify({
      success: true,
      data: items
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in GET /api/order-items/[orderId]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al obtener los items de la orden'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}));

export const POST: APIRoute = withCors(withAuth(async (context) => {
  try {
    const orderId = parseInt(context.params.orderId as string);
    const itemsData = await context.request.json();

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

    // Validar si es un array de items o un solo item
    const items = Array.isArray(itemsData) ? itemsData : [itemsData];

    // Validar cada item
    for (const item of items) {
      if (!item.product_id || !item.quantity || !item.product_price) {
        return new Response(JSON.stringify({
          success: false,
          error: 'product_id, quantity y product_price son requeridos para cada item'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

      // Validar stock si es necesario
      const hasStock = await OrderItemService.validateStock(item.product_id, item.quantity);
      if (!hasStock) {
        return new Response(JSON.stringify({
          success: false,
          error: `Stock insuficiente para el producto ${item.product_name || item.product_id}`
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

      // Agregar order_id y calcular total
      item.order_id = orderId;
      item.total = item.product_price * item.quantity;
    }

    let result;
    if (Array.isArray(itemsData)) {
      result = await OrderItemService.createOrderItems(items);
    } else {
      result = await OrderItemService.createOrderItem(items[0]);
    }

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in POST /api/order-items/[orderId]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al crear los items de la orden'
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
    const orderId = parseInt(context.params.orderId as string);

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

    await OrderItemService.deleteOrderItems(orderId);

    return new Response(JSON.stringify({
      success: true,
      message: 'Items de la orden eliminados correctamente'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in DELETE /api/order-items/[orderId]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al eliminar los items de la orden'
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
