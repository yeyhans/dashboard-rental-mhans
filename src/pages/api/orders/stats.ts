import type { APIRoute } from 'astro';
import { OrderService } from '../../../services/orderService';
import { withAuth, withCors } from '../../../middleware/auth';

export const GET: APIRoute = withCors(withAuth(async (context) => {
  try {
    const stats = await OrderService.getOrderStats();

    return new Response(JSON.stringify({
      success: true,
      data: stats
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in GET /api/orders/stats:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al obtener estadísticas de órdenes'
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
