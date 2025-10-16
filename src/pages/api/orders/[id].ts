import type { APIRoute } from 'astro';
import { OrderService } from '../../../services/orderService';
import { withAuth } from '../../../middleware/auth';
// withCors removed - global middleware handles CORS

export const GET: APIRoute = withAuth(async (context) => {
  try {
    const orderId = parseInt(context.params.id as string);

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

    const order = await OrderService.getOrderById(orderId);

    if (!order) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Orden no encontrada'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: order
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in GET /api/orders/[id]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al obtener la orden'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});

export const PUT: APIRoute = withAuth(async (context) => {
  try {
    console.log('🔄 PUT /api/orders/[id] - Iniciando actualización');
    const orderId = parseInt(context.params.id as string);
    const updates = await context.request.json();
    
    console.log('📦 Order ID:', orderId);
    console.log('📤 Updates received:', JSON.stringify(updates, null, 2));

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

    // Verificar que la orden existe
    const existingOrder = await OrderService.getOrderById(orderId);
    if (!existingOrder) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Orden no encontrada'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('🔄 Llamando OrderService.updateOrder...');
    const updatedOrder = await OrderService.updateOrder(orderId, {
      ...updates,
      date_modified: new Date().toISOString()
    });
    
    console.log('✅ Orden actualizada exitosamente:', updatedOrder?.id);

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
    console.error('Error in PUT /api/orders/[id]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al actualizar la orden'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});

export const DELETE: APIRoute = withAuth(async (context) => {
  try {
    const orderId = parseInt(context.params.id as string);

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

    // Verificar que la orden existe
    const existingOrder = await OrderService.getOrderById(orderId);
    if (!existingOrder) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Orden no encontrada'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    await OrderService.deleteOrder(orderId);

    return new Response(JSON.stringify({
      success: true,
      message: 'Orden eliminada correctamente'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in DELETE /api/orders/[id]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al eliminar la orden'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});

// OPTIONS handler removed - handled by global middleware
