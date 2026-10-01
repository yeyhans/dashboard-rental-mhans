import type { APIRoute } from 'astro';
import { withAuth } from '../../../../../middleware/auth';
import { CommunicationsDataService } from '../../../../../services/communicationsDataService';

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Marks every unread message in the thread that was not written by `userId`. */
export const POST: APIRoute = withAuth(async (context) => {
  const orderId = parseInt(String(context.params.orderId), 10);
  if (Number.isNaN(orderId) || orderId <= 0) {
    return json({ success: false, error: 'ID de orden inválido' }, 400);
  }

  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return json({ success: false, error: 'JSON inválido' }, 400);
  }

  if (!body?.userId) {
    return json({ success: false, error: 'userId es requerido' }, 400);
  }

  try {
    const updated = await CommunicationsDataService.markThreadAsRead(orderId, String(body.userId));
    return json({ success: true, data: { updated } }, 200);
  } catch (error) {
    console.error('[POST /api/communications/order/[orderId]/mark-read] Error:', {
      orderId,
      adminId: context.user?.id,
      error,
    });
    return json({ success: false, error: 'Error al marcar los mensajes como leídos' }, 500);
  }
});
