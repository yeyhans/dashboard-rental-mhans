import type { APIRoute } from 'astro';
import { CouponService } from '../../../../services/couponService';
import { checkRateLimit, getClientIp, rateLimitResponse } from '../../../../lib/rateLimit';

// Rate limit config: 10 requests per 60 seconds per IP
const COUPON_VALIDATE_RATE_LIMIT = { name: 'coupon-validate', maxRequests: 10, windowMs: 60 * 1000 };

export const GET: APIRoute = async (context) => {
  // Apply rate limiting before processing
  const ip = getClientIp(context.request);
  const rl = checkRateLimit(ip, COUPON_VALIDATE_RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

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
};

export const POST: APIRoute = async (context) => {
  // Apply rate limiting before processing
  const ip = getClientIp(context.request);
  const rl = checkRateLimit(ip, COUPON_VALIDATE_RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

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
};

// OPTIONS handler removed - handled by global middleware
