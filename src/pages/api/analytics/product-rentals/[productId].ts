import type { APIRoute } from 'astro';
import { AdvancedAnalyticsService } from '../../../../services/advancedAnalyticsService';
import { withAuth } from '../../../../middleware/auth';

export const GET: APIRoute = withAuth(async (context) => {
  try {
    const productId = parseInt(context.params.productId as string);

    if (isNaN(productId)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de producto inválido'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Obtener parámetros de consulta opcionales
    const url = new URL(context.request.url);
    const startDateParam = url.searchParams.get('startDate');
    const endDateParam = url.searchParams.get('endDate');

    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    // Validar fechas si se proporcionaron
    if (startDate && isNaN(startDate.getTime())) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Fecha de inicio inválida'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    if (endDate && isNaN(endDate.getTime())) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Fecha de fin inválida'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const rentals = await AdvancedAnalyticsService.getProductRentals(
      productId,
      startDate,
      endDate
    );

    return new Response(JSON.stringify({
      success: true,
      data: rentals
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/product-rentals/[productId]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener las rentas del producto'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});

