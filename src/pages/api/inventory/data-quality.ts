import type { APIRoute } from 'astro';
import { withAuth } from '../../../middleware/auth';
import { SerialisedAssetService } from '../../../services/serialisedAssetService';

// Data-quality review list (M6, T-036). Surfaces catalogue rows with missing audited fields so
// they are visible rather than silently accepted or silently rejected during the physical count.
// CORS handled by global middleware.
export const GET: APIRoute = withAuth(async ({ locals }) => {
  try {
    const report = await SerialisedAssetService.getDataQualityReport();
    return new Response(JSON.stringify({ success: true, data: report }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[GET /api/inventory/data-quality] Error:', {
      error,
      userId: (locals as { user?: { id: string } })?.user?.id,
    });
    return new Response(
      JSON.stringify({ success: false, error: 'Error al obtener el reporte de calidad de datos' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
