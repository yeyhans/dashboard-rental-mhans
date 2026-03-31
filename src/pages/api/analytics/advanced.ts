import type { APIRoute } from 'astro';
import { withAuth } from '@/middleware/auth';
import { AdvancedAnalyticsService } from '../../../services/advancedAnalyticsService';

export const GET: APIRoute = withAuth(async ({ request }) => {
  try {
    const searchParams = new URL(request.url).searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    console.log('[Analytics] Advanced analytics requested:', { startDate, endDate });

    const analytics = await AdvancedAnalyticsService.getAdvancedAnalytics(
      startDate || undefined,
      endDate || undefined
    );

    return new Response(JSON.stringify({
      success: true,
      data: analytics
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Analytics] Error fetching advanced analytics:', error);

    return new Response(JSON.stringify({
      success: false,
      error: 'Error al obtener analytics avanzados'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
