import type { APIRoute } from 'astro';
import { CouponService } from '../../../services/couponService';
import { withAuth, withCors } from '../../../middleware/auth';

export const GET: APIRoute = withCors(withAuth(async (context) => {
  try {
    const couponId = parseInt(context.params.id as string);

    if (isNaN(couponId)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de cupón inválido'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const coupon = await CouponService.getCouponById(couponId);

    if (!coupon) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cupón no encontrado'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: coupon
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in GET /api/coupons/[id]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al obtener el cupón'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}));

export const PUT: APIRoute = withCors(withAuth(async (context) => {
  try {
    const couponId = parseInt(context.params.id as string);
    const updates = await context.request.json();

    if (isNaN(couponId)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de cupón inválido'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Verificar que el cupón existe
    const existingCoupon = await CouponService.getCouponById(couponId);
    if (!existingCoupon) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cupón no encontrado'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Validar tipo de descuento si se está actualizando
    if (updates.discount_type) {
      const allowedDiscountTypes = ['percent', 'fixed_cart', 'fixed_product'];
      if (!allowedDiscountTypes.includes(updates.discount_type)) {
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
    }

    const updatedCoupon = await CouponService.updateCoupon(couponId, updates);

    return new Response(JSON.stringify({
      success: true,
      data: updatedCoupon
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in PUT /api/coupons/[id]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al actualizar el cupón'
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
    const couponId = parseInt(context.params.id as string);

    if (isNaN(couponId)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de cupón inválido'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Verificar que el cupón existe
    const existingCoupon = await CouponService.getCouponById(couponId);
    if (!existingCoupon) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cupón no encontrado'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    await CouponService.deleteCoupon(couponId);

    return new Response(JSON.stringify({
      success: true,
      message: 'Cupón eliminado correctamente'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in DELETE /api/coupons/[id]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al eliminar el cupón'
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
