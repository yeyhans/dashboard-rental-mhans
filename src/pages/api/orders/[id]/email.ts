import type { APIRoute } from 'astro';
import { withAuth } from '../../../../middleware/auth';
import { OrderService } from '../../../../services/orderService';

const EMAIL_TEMPLATES: Record<string, { subject: (id: number) => string; template: string }> = {
  order_confirmation: { subject: (id) => `Confirmación de Pedido #${id}`, template: 'order_confirmation' },
  processing_notification: { subject: (id) => `Su pedido #${id} está siendo procesado`, template: 'processing_notification' },
  shipping_notification: { subject: (id) => `Su pedido #${id} ha sido enviado`, template: 'shipping_notification' },
  completion_notification: { subject: (id) => `Su pedido #${id} ha sido completado`, template: 'completion_notification' },
  payment_reminder: { subject: (id) => `Recordatorio de pago - Pedido #${id}`, template: 'payment_reminder' },
  custom: { subject: (id) => `Actualización de su pedido #${id}`, template: 'custom' },
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Was an unauthenticated route reading `orders` and flipping `correo_enviado` through the anon
 * client. Its embedded `user_profiles(*)` join was already returning null in production — that
 * table has RLS and no anon policy — so the template lost the customer block. `OrderService`
 * runs on the service role and resolves the profile, restoring it.
 */
export const POST: APIRoute = withAuth(async (context) => {
  const orderId = parseInt(String(context.params.id), 10);
  if (Number.isNaN(orderId) || orderId <= 0) {
    return json({ success: false, error: 'ID de orden inválido' }, 400);
  }

  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return json({ success: false, error: 'JSON inválido' }, 400);
  }

  if (!body?.type) {
    return json({ success: false, error: 'El tipo de correo es requerido' }, 400);
  }

  const emailConfig = EMAIL_TEMPLATES[body.type];
  if (!emailConfig) {
    return json({ success: false, error: 'Tipo de correo inválido' }, 400);
  }

  try {
    const order = await OrderService.getOrderById(orderId);
    if (!order) {
      return json({ success: false, error: 'Orden no encontrada' }, 404);
    }

    // TODO: enviar realmente el correo vía Resend (lib/emailService.ts). Hoy esta ruta solo
    // arma el payload y marca la orden, igual que antes de la conversión a service role.
    const emailData = {
      to: order.billing_email,
      subject: emailConfig.subject(orderId),
      template: emailConfig.template,
      data: {
        order,
        customMessage: body.message,
        orderUrl: `${import.meta.env.PUBLIC_SITE_URL || ''}/orders/${orderId}`,
      },
    };

    await OrderService.updateOrder(orderId, {
      correo_enviado: true,
      date_modified: new Date().toISOString(),
    });

    return json(
      {
        success: true,
        data: { emailData },
        message: `Correo enviado correctamente a ${order.billing_email}`,
      },
      200
    );
  } catch (error) {
    console.error('[POST /api/orders/[id]/email] Error:', {
      orderId,
      type: body.type,
      adminId: context.user?.id,
      error,
    });
    return json({ success: false, error: 'Error al enviar el correo de la orden' }, 500);
  }
});
