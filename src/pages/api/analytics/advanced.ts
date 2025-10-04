import type { APIRoute } from 'astro';
import { AdvancedAnalyticsService } from '../../../services/advancedAnalyticsService';

export const GET: APIRoute = async ({ request, url }) => {
  try {
    // Obtener parámetros de consulta
    const searchParams = new URL(request.url).searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    console.log('🔍 Advanced Analytics API called with:', { startDate, endDate });

    // Obtener estadísticas avanzadas
    const analytics = await AdvancedAnalyticsService.getAdvancedAnalytics(
      startDate || undefined,
      endDate || undefined
    );

    console.log('✅ Advanced analytics fetched successfully');

    return new Response(JSON.stringify({
      success: true,
      data: analytics
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });

  } catch (error) {
    console.error('❌ Error in advanced analytics API:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al obtener analytics'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
};
