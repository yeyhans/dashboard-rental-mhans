import type { APIRoute } from 'astro';
import { OrderService } from '../../../services/orderService';
import { withAuth, withCors } from '../../../middleware/auth';

export const GET: APIRoute = withCors(withAuth(async (context) => {
  try {
    const url = new URL(context.request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const status = url.searchParams.get('status') || undefined;
    const search = url.searchParams.get('search');
    const userId = url.searchParams.get('userId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    let result;

    if (search) {
      result = await OrderService.searchOrders(search, page, limit);
    } else if (userId) {
      result = await OrderService.getOrdersByUser(parseInt(userId), page, limit);
    } else if (startDate && endDate) {
      result = await OrderService.getOrdersByDateRange(startDate, endDate, page, limit);
    } else {
      result = await OrderService.getAllOrders(page, limit, status);
    }

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in GET /api/orders:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al obtener las órdenes'
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
    const orderData = await context.request.json();

    // Validaciones básicas
    if (!orderData.customer_id || !orderData.billing_email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'customer_id y billing_email son requeridos'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const order = await OrderService.createOrder({
      ...orderData,
      date_created: new Date().toISOString(),
      date_modified: new Date().toISOString(),
      status: orderData.status || 'pending'
    });

    return new Response(JSON.stringify({
      success: true,
      data: order
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in POST /api/orders:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al crear la orden'
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
