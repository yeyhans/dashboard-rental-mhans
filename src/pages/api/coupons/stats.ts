import type { APIRoute } from 'astro';
import { CouponService } from '../../../services/couponService';
import { withAuth, withCors } from '../../../middleware/auth';

export const GET: APIRoute = withCors(withAuth(async (context) => {
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
}));

export const OPTIONS: APIRoute = withCors(async () => {
  return new Response(null, { status: 200 });
});
