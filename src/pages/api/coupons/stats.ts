import type { APIRoute } from 'astro';
import { CouponService } from '../../../services/couponService';
import { withAuth } from '../../../middleware/auth';
// withCors removed - global middleware handles CORS

export const GET: APIRoute = withAuth(async (context) => {
  try {
    const stats = await CouponService.getCouponStats();

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
    console.error('Error in GET /api/coupons/stats:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al obtener estadísticas de cupones'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});

// OPTIONS handler removed - handled by global middleware
