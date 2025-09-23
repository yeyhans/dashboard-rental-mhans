import type { APIRoute } from 'astro';
import { OrderService } from '../../../../services/orderService';

export const PUT: APIRoute = async ({ params, request }) => {
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
    
    // Financial calculations
    if (updateData.calculated_subtotal !== undefined) sanitizedData.calculated_subtotal = Number(updateData.calculated_subtotal);
    if (updateData.calculated_discount !== undefined) sanitizedData.calculated_discount = Number(updateData.calculated_discount);
    if (updateData.calculated_iva !== undefined) sanitizedData.calculated_iva = Number(updateData.calculated_iva);
    if (updateData.calculated_total !== undefined) {
      sanitizedData.calculated_total = Number(updateData.calculated_total);
      sanitizedData.total = Number(updateData.calculated_total); // Keep both fields in sync
    }
    
    // Status flags
    if (updateData.correo_enviado !== undefined) sanitizedData.correo_enviado = Boolean(updateData.correo_enviado);
    if (updateData.pago_completo !== undefined) {
      // Handle both boolean and string values
      if (typeof updateData.pago_completo === 'string') {
        sanitizedData.pago_completo = updateData.pago_completo === 'true';
      } else {
        sanitizedData.pago_completo = Boolean(updateData.pago_completo);
      }
    }
    
    // Line items (JSON field)
    if (updateData.line_items !== undefined) {
      sanitizedData.line_items = Array.isArray(updateData.line_items) 
        ? updateData.line_items 
        : JSON.parse(updateData.line_items);
    }
    
    // Document URLs
    if (updateData.orden_compra !== undefined) sanitizedData.orden_compra = updateData.orden_compra;
    if (updateData.numero_factura !== undefined) sanitizedData.numero_factura = updateData.numero_factura;
    
    // Update modification date
    sanitizedData.date_modified = new Date().toISOString();
    
    // If status is being changed to completed, set completion date
    if (updateData.status === 'completed' && !sanitizedData.date_completed) {
      sanitizedData.date_completed = new Date().toISOString();
    }

    console.log('Updating order with data:', sanitizedData);

    // Update the order using the service
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
};

export const PATCH: APIRoute = async (context) => {
  // PATCH method for partial updates
  return PUT(context);
};
