import type { APIRoute } from 'astro';
import { withAuth } from '../../../../middleware/auth';
import { CommunicationsDataService } from '../../../../services/communicationsDataService';
import type { CommunicationMessageType, CommunicationUserType } from '../../../../types/communications';

const USER_TYPES: CommunicationUserType[] = ['customer', 'admin'];
const MESSAGE_TYPES: CommunicationMessageType[] = ['text', 'image', 'file'];

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseOrderId(raw: unknown): number | null {
  const orderId = parseInt(String(raw), 10);
  return Number.isNaN(orderId) || orderId <= 0 ? null : orderId;
}

/** Thread of an order. Admin-gated + service role: RLS on `order_communications` is bypassed. */
export const GET: APIRoute = withAuth(async (context) => {
  const orderId = parseOrderId(context.params.orderId);
  if (orderId === null) {
    return json({ success: false, error: 'ID de orden inválido' }, 400);
  }

  const params = new URL(context.request.url).searchParams;
  const search = params.get('search')?.trim();
  const page = parseInt(params.get('page') || '', 10);
  const limit = parseInt(params.get('limit') || '', 10);

  const options: { search?: string; page?: number; limit?: number } = {};
  if (search) options.search = search;
  if (!Number.isNaN(page) && page > 0 && !Number.isNaN(limit) && limit > 0) {
    options.page = page;
    options.limit = limit;
  }

  try {
    const { messages, total } = await CommunicationsDataService.listByOrder(orderId, options);
    const effectivePage = options.page ?? 1;
    const effectiveLimit = options.limit ?? total;

    return json(
      {
        success: true,
        data: {
          messages,
          total,
          page: effectivePage,
          limit: effectiveLimit,
          hasMore: total > (effectivePage - 1) * effectiveLimit + messages.length,
        },
      },
      200
    );
  } catch (error) {
    console.error('[GET /api/communications/order/[orderId]] Error:', {
      orderId,
      adminId: context.user?.id,
      error,
    });
    return json({ success: false, error: 'Error al obtener los mensajes de la orden' }, 500);
  }
});

/** Sends a message into the order thread. */
export const POST: APIRoute = withAuth(async (context) => {
  const orderId = parseOrderId(context.params.orderId);
  if (orderId === null) {
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

  if (!USER_TYPES.includes(body.userType)) {
    return json({ success: false, error: 'userType inválido. Debe ser customer o admin' }, 400);
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return json({ success: false, error: 'El mensaje no puede estar vacío' }, 400);
  }

  const messageType: CommunicationMessageType = body.messageType || 'text';
  if (!MESSAGE_TYPES.includes(messageType)) {
    return json({ success: false, error: 'messageType inválido. Debe ser text, image o file' }, 400);
  }

  try {
    const created = await CommunicationsDataService.create({
      orderId,
      userId: String(body.userId),
      userType: body.userType,
      message,
      messageType,
      fileUrl: body.fileUrl,
      fileName: body.fileName,
      userName: body.userName,
      userEmail: body.userEmail,
    });

    return json({ success: true, data: created }, 201);
  } catch (error) {
    console.error('[POST /api/communications/order/[orderId]] Error:', {
      orderId,
      adminId: context.user?.id,
      error,
    });
    return json({ success: false, error: 'Error al enviar el mensaje' }, 500);
  }
});
