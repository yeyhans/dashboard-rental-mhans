import type { APIRoute } from 'astro';
import { withAuth } from '../../../middleware/auth';
import { BodegaService } from '../../../services/bodegaService';

// GET /api/bodega/board — the garage board, for the refresh button on `/bodega`. Reachable by
// operators (allowlisted in `lib/accessControl.ts`) and by admins. Read-only; the clock is the
// server's, same as the SSR render. CORS handled by global middleware.

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export const GET: APIRoute = withAuth(async ({ locals }) => {
  try {
    const board = await BodegaService.getBoard(new Date());
    return json({ success: true, data: board }, 200);
  } catch (error) {
    console.error('[GET /api/bodega/board] Error:', {
      error,
      userId: (locals as { user?: { id: string } })?.user?.id,
    });
    return json({ success: false, error: 'No se pudo cargar el tablero de bodega' }, 500);
  }
});
