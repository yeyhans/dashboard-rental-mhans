import type { APIRoute } from 'astro';
import { CouponService } from '../../../services/couponService';
import { withAuth, withCors } from '../../../middleware/auth';

export const GET: APIRoute = withCors(withAuth(async (context) => {
  try {
    const url = new URL(context.request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const status = url.searchParams.get('status') || undefined;
    const search = url.searchParams.get('search');

    let result;

    if (search) {
      result = await CouponService.searchCoupons(search, page, limit);
    } else {
      result = await CouponService.getAllCoupons(page, limit, status);
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
    console.error('Error in GET /api/coupons:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al obtener los cupones'
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
    const couponData = await context.request.json();

    // Validaciones básicas
    if (!couponData.code || !couponData.discount_type || !couponData.amount) {
      return new Response(JSON.stringify({
        success: false,
        error: 'code, discount_type y amount son requeridos'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Validar tipo de descuento
    const allowedDiscountTypes = ['percent', 'fixed_cart', 'fixed_product'];
    if (!allowedDiscountTypes.includes(couponData.discount_type)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Tipo de descuento no válido'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const coupon = await CouponService.createCoupon({
      ...couponData,
      date_created: new Date().toISOString(),
      date_modified: new Date().toISOString(),
      status: couponData.status || 'publish',
      usage_count: 0
    });

    return new Response(JSON.stringify({
      success: true,
      data: coupon
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in POST /api/coupons:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al crear el cupón'
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
