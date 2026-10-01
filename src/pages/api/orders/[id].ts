import type { APIRoute } from 'astro';
import { OrderService } from '../../../services/orderService';
import { withAuth } from '../../../middleware/auth';
import { OrderPricingService } from '../../../services/orderPricingService';
import { validateReserveInput } from '../../../lib/finance';
import { PricingError } from '../../../lib/pricing';
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

    // Reserva configurable (`orders.reserve_type` / `reserve_value`, migración 0008). Misma
    // validación que `PUT /api/orders/update/:id`: sin ella un porcentaje fuera de rango llegaba
    // a la CHECK de Postgres y volvía al panel como un 500 con detalle interno.
    const reserveError = validateReserveInput(updates);
    if (reserveError) {
      return new Response(JSON.stringify({ success: false, error: reserveError }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (updates.reserve_value !== undefined) {
      updates.reserve_value = Number(updates.reserve_value);
    }

    // Montos: se recalculan en el servidor desde la orden guardada + el cambio. Los calculated_*
    // del cliente se sobrescriben y `apply_iva` es solo un insumo (no existe como columna).
    let pricedFields;
    try {
      pricedFields = await OrderPricingService.priceOrderUpdate(existingOrder, updates);
    } catch (pricingError) {
      if (pricingError instanceof PricingError) {
        console.error('[PUT /api/orders/:id] Montos inválidos:', { orderId, error: pricingError.message });
        return new Response(JSON.stringify({
          success: false,
          error: pricingError.message
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      throw pricingError;
    }
    const { apply_iva: _applyIva, ...persistableUpdates } = updates;

    console.log('🔄 Llamando OrderService.updateOrder...');
    const updatedOrder = await OrderService.updateOrder(orderId, {
      ...persistableUpdates,
      ...(pricedFields ?? {}),
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
