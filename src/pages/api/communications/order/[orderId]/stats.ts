import type { APIRoute } from 'astro';
import { withAuth } from '../../../../../middleware/auth';
import { CommunicationsDataService } from '../../../../../services/communicationsDataService';

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Communication stats for one order.
 *
 * `?userId=` scopes the unread count to messages written by the other party.
 * `?advanced=true` appends the detailed block under `data.advanced`.
 */
export const GET: APIRoute = withAuth(async (context) => {
  const orderId = parseInt(String(context.params.orderId), 10);
  if (Number.isNaN(orderId) || orderId <= 0) {
    return json({ success: false, error: 'ID de orden inválido' }, 400);
  }

  const params = new URL(context.request.url).searchParams;
  const userId = params.get('userId') || undefined;
  const wantsAdvanced = params.get('advanced') === 'true';

  try {
    const stats = await CommunicationsDataService.getStats(orderId, userId);
    const advanced = wantsAdvanced ? await CommunicationsDataService.getAdvancedStats(orderId) : undefined;

    return json({ success: true, data: { ...stats, ...(advanced ? { advanced } : {}) } }, 200);
  } catch (error) {
    console.error('[GET /api/communications/order/[orderId]/stats] Error:', {
      orderId,
      adminId: context.user?.id,
      error,
    });
    return json({ success: false, error: 'Error al obtener las estadísticas de comunicación' }, 500);
  }
});
