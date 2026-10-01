import type { APIRoute } from 'astro';
import { withAuth } from '../../../middleware/auth';
import { SerialisedAssetService } from '../../../services/serialisedAssetService';

// Intake progress summary (M6, T-036). The queryable indicator of physical-count progress that
// ADR-003 / O-5 is tracked against, so the client dependency needs no manual reconciliation.
// CORS handled by global middleware.
export const GET: APIRoute = withAuth(async ({ locals }) => {
  try {
    const progress = await SerialisedAssetService.getIntakeProgress();
    return new Response(JSON.stringify({ success: true, data: progress }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[GET /api/inventory/progress] Error:', {
      error,
      userId: (locals as { user?: { id: string } })?.user?.id,
    });
    return new Response(
      JSON.stringify({ success: false, error: 'Error al obtener el avance del inventario' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
