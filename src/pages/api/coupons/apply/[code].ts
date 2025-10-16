import type { APIRoute } from 'astro';
import { CouponService } from '../../../../services/couponService';
// withAuth and withCors removed - global middleware handles CORS, endpoint is public

export const POST: APIRoute = async (context) => {
  try {
    const couponCode = context.params.code as string;
    const { userId, discountAmount, orderId } = await context.request.json();

    if (!couponCode) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Código de cupón requerido'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    if (!userId || !discountAmount) {
      return new Response(JSON.stringify({
        success: false,
        error: 'userId y discountAmount son requeridos'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const applicationResult = await CouponService.applyCoupon(couponCode, userId, discountAmount, orderId);

    return new Response(JSON.stringify({
      success: applicationResult.success,
      data: applicationResult
    }), {
      status: applicationResult.success ? 200 : 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in POST /api/coupons/apply/[code]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al aplicar el cupón'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};

// OPTIONS handler removed - handled by global middleware
