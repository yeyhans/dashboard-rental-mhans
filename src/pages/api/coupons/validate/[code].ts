import type { APIRoute } from 'astro';
import { CouponService } from '../../../../services/couponService';
import { withAuth, withCors } from '../../../../middleware/auth';

export const GET: APIRoute = withCors(withAuth(async (context) => {
  try {
    const couponCode = context.params.code as string;
    const url = new URL(context.request.url);
    const userId = parseInt(url.searchParams.get('userId') || '0');
    const subtotal = parseFloat(url.searchParams.get('subtotal') || '0');

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

    const validationResult = await CouponService.validateCoupon(couponCode, userId, subtotal);

    return new Response(JSON.stringify({
      success: true,
      data: validationResult
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in GET /api/coupons/validate/[code]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al validar el cupón'
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
    const couponCode = context.params.code as string;
    const { userId, cartTotal } = await context.request.json();

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

    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de usuario requerido'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const validationResult = await CouponService.validateCoupon(couponCode, userId, cartTotal);

    return new Response(JSON.stringify({
      success: true,
      data: validationResult
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in POST /api/coupons/validate/[code]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al validar el cupón'
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
