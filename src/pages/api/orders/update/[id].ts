import type { APIRoute } from 'astro';
import { canonicalStatus } from '../../../../lib/orderStatus';
import { OrderService } from '../../../../services/orderService';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createInternalApiHeaders } from '../../../../lib/serverApiAuth';
import { withAuth } from '../../../../middleware/auth';

export const PUT: APIRoute = withAuth(async ({ params, request }) => {
  try {
    const orderId = params.id;
    
    if (!orderId || isNaN(Number(orderId))) {
      return new Response(JSON.stringify({
        success: false,
        message: 'ID de orden inválido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const updateData = await request.json();
    
    // Get current order data BEFORE update (needed for email templates)
    const { data: currentOrder } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', Number(orderId))
      .single();
    
    if (!currentOrder) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Orden no encontrada'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const previousStatus = currentOrder.status;
    const newStatus = updateData.status;
    
    // Validate required fields and sanitize data
    const sanitizedData: any = {};
    
    // Basic order fields
    if (updateData.status) sanitizedData.status = updateData.status;
    if (updateData.customer_note !== undefined) sanitizedData.customer_note = updateData.customer_note;
    if (updateData.payment_method) sanitizedData.payment_method = updateData.payment_method;
    if (updateData.payment_method_title) sanitizedData.payment_method_title = updateData.payment_method_title;
    if (updateData.transaction_id !== undefined) sanitizedData.transaction_id = updateData.transaction_id;
    
    // Billing information
    if (updateData.billing_first_name !== undefined) sanitizedData.billing_first_name = updateData.billing_first_name;
    if (updateData.billing_last_name !== undefined) sanitizedData.billing_last_name = updateData.billing_last_name;
    if (updateData.billing_company !== undefined) sanitizedData.billing_company = updateData.billing_company;
    if (updateData.billing_address_1 !== undefined) sanitizedData.billing_address_1 = updateData.billing_address_1;
    if (updateData.billing_city !== undefined) sanitizedData.billing_city = updateData.billing_city;
    if (updateData.billing_email !== undefined) sanitizedData.billing_email = updateData.billing_email;
    if (updateData.billing_phone !== undefined) sanitizedData.billing_phone = updateData.billing_phone;
    
    // Project information
    if (updateData.order_proyecto !== undefined) sanitizedData.order_proyecto = updateData.order_proyecto;
    if (updateData.order_fecha_inicio !== undefined) sanitizedData.order_fecha_inicio = updateData.order_fecha_inicio;
    if (updateData.order_fecha_termino !== undefined) sanitizedData.order_fecha_termino = updateData.order_fecha_termino;
    if (updateData.num_jornadas !== undefined) sanitizedData.num_jornadas = Number(updateData.num_jornadas);
    if (updateData.company_rut !== undefined) sanitizedData.company_rut = updateData.company_rut;
    
    // Retirement information
    if (updateData.order_retire_name !== undefined) sanitizedData.order_retire_name = updateData.order_retire_name;
    if (updateData.order_retire_phone !== undefined) sanitizedData.order_retire_phone = updateData.order_retire_phone;
    if (updateData.order_retire_rut !== undefined) sanitizedData.order_retire_rut = updateData.order_retire_rut;
    if (updateData.order_comments !== undefined) sanitizedData.order_comments = updateData.order_comments;
    
    // Financial calculations — fuente de verdad: campos calculated_*
    // Los campos total, total_tax y cart_tax son legacy de WooCommerce (deprecados).
    // total se mantiene sincronizado con calculated_total por backward compatibility.
    if (updateData.calculated_subtotal !== undefined) sanitizedData.calculated_subtotal = Number(updateData.calculated_subtotal);
    if (updateData.calculated_discount !== undefined) sanitizedData.calculated_discount = Number(updateData.calculated_discount);
    if (updateData.calculated_iva !== undefined) sanitizedData.calculated_iva = Number(updateData.calculated_iva);
    if (updateData.calculated_total !== undefined) {
      sanitizedData.calculated_total = Number(updateData.calculated_total);
      sanitizedData.total = Number(updateData.calculated_total); // legacy sync — no usar total como fuente de verdad
    }
    
    // Status flags
    if (updateData.correo_enviado !== undefined) sanitizedData.correo_enviado = Boolean(updateData.correo_enviado);
    if (updateData.pago_reserva !== undefined) {
      if (typeof updateData.pago_reserva === 'string') {
        sanitizedData.pago_reserva = updateData.pago_reserva === 'true';
      } else {
        sanitizedData.pago_reserva = Boolean(updateData.pago_reserva);
      }
    }
    if (updateData.pago_completo !== undefined) {
      // Handle both boolean and string values
      if (typeof updateData.pago_completo === 'string') {
        sanitizedData.pago_completo = updateData.pago_completo === 'true';
      } else {
        sanitizedData.pago_completo = Boolean(updateData.pago_completo);
      }
    }
    // Invariante de negocio: pago completo implica reserva pagada
    if (sanitizedData.pago_completo === true) {
      sanitizedData.pago_reserva = true;
    }
    
    // Line items (JSON field)
    if (updateData.line_items !== undefined) {
      sanitizedData.line_items = Array.isArray(updateData.line_items) 
        ? updateData.line_items 
        : JSON.parse(updateData.line_items);
    }
    
    // Reserve configuration (`orders.reserve_type` / `reserve_value`, migración 0008).
    //
    // Se valida el PAR completo y se rechaza con 400 en español. Antes, un valor fuera de rango
    // se descartaba en silencio —el admin creía haber guardado— y un porcentaje mayor a 100 se
    // enviaba tal cual a la base, donde la CHECK de 0008 lo rechaza con un error interno que
    // llegaba al panel como un 500. `ProcessOrder.tsx:579` ya topaba el 100 en el cliente, pero
    // esa validación es sólo UX: la del servidor es la que manda.
    const wantsReserveType = updateData.reserve_type !== undefined;
    const wantsReserveValue = updateData.reserve_value !== undefined;

    if (wantsReserveType !== wantsReserveValue) {
      // Sin el tipo no se sabe si "500" son 500% (inválido) o $500 (válido). Ambos call sites del
      // panel mandan los dos campos juntos.
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Para cambiar la reserva hay que enviar el tipo y el valor juntos',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (wantsReserveType && wantsReserveValue) {
      const validTypes = ['percent', 'fixed'];
      if (!validTypes.includes(updateData.reserve_type)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'El tipo de reserva debe ser "percent" (porcentaje) o "fixed" (monto fijo)',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const numValue = Number(updateData.reserve_value);
      if (!Number.isFinite(numValue) || numValue < 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'El valor de la reserva debe ser un número positivo' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (updateData.reserve_type === 'percent' && numValue > 100) {
        return new Response(
          JSON.stringify({ success: false, error: 'El porcentaje de reserva no puede ser mayor a 100' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      sanitizedData.reserve_type = updateData.reserve_type;
      sanitizedData.reserve_value = numValue;
    }

    // Document URLs
    if (updateData.orden_compra !== undefined) sanitizedData.orden_compra = updateData.orden_compra;
    if (updateData.numero_factura !== undefined) sanitizedData.numero_factura = updateData.numero_factura;
    
    // Update modification date
    sanitizedData.date_modified = new Date().toISOString();
    
    // If status is being changed to completed, set completion date
    if (canonicalStatus(updateData.status) === 'completed' && !sanitizedData.date_completed) {
      sanitizedData.date_completed = new Date().toISOString();
    }

    // Se compara el estado normalizado, no el literal. `failed` desaparece en 0003 plegado sobre
    // `cancelled`: comparar contra `'failed'` haria que el correo de disculpas dejara de salir
    // justo cuando el pedido no prospera, que es cuando mas importa.
    const nuevoCanonico = canonicalStatus(newStatus);
    const anteriorCanonico = canonicalStatus(previousStatus);
    const notificationTarget = nuevoCanonico === 'completed' && anteriorCanonico !== 'completed'
      ? { path: '/api/emails/send-order-completed-notification', emailType: 'order_completed' }
      : nuevoCanonico === 'cancelled' && anteriorCanonico !== 'cancelled'
        ? { path: '/api/emails/send-order-failed-notification', emailType: 'order_failed' }
        : null;

    if (notificationTarget) {
      const notificationOrder = { ...currentOrder, ...sanitizedData };
      const notificationUrl = new URL(notificationTarget.path, request.url).toString();
      console.log('📧 [Order Update] Status changed, sending notification email...', {
        orderId,
        newStatus,
        notificationUrl,
      });

      const notificationResponse = await fetch(notificationUrl, {
        method: 'POST',
        headers: createInternalApiHeaders(crypto.randomUUID()),
        body: JSON.stringify({
          orderData: notificationOrder,
          emailType: notificationTarget.emailType
        })
      });

      if (!notificationResponse.ok) {
        const errorText = await notificationResponse.text();
        console.error('❌ [Order Update] Required notification email failed:', {
          orderId,
          newStatus,
          status: notificationResponse.status,
          error: errorText,
        });

        return new Response(JSON.stringify({
          success: false,
          message: 'No se pudo enviar el correo requerido del flujo. La orden no fue actualizada.',
          notificationError: 'required_notification_failed'
        }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      console.log('✅ [Order Update] Required notification email sent successfully');
    }

    console.log('Updating order with data:', sanitizedData);

    // Update the order using the service only after required status notifications succeed.
    const updatedOrder = await OrderService.updateOrder(Number(orderId), sanitizedData);

    return new Response(JSON.stringify({
      success: true,
      message: 'Orden actualizada correctamente',
      data: updatedOrder
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating order:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Error al actualizar la orden',
      error: error instanceof Error ? error.message : 'Error desconocido'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

export const PATCH: APIRoute = async (context) => {
  // PATCH method for partial updates
  return PUT(context);
};
