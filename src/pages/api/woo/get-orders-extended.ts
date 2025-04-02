import type { APIRoute } from 'astro';
import WooCommerce from './apiroute';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Get order ID from URL parameters
    const url = new URL(request.url);
    const orderIdParam = url.searchParams.get('orderId');

    if (!orderIdParam) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Se requiere el ID de la orden'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Convert orderId to number
    const orderId = parseInt(orderIdParam, 10);
    
    if (isNaN(orderId)) {
      return new Response(JSON.stringify({
        success: false,
        message: 'El ID de la orden debe ser un número'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Fetch specific order from WooCommerce
    const response = await WooCommerce.get('orders', { 
      include: [orderId],
      per_page: 1
    });
    const order = response.data[0];

    if (!order) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Orden no encontrada'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Debug logs
    console.log('Order ID:', order.id);
    console.log('All meta_data:', JSON.stringify(order.meta_data, null, 2));
    
    // Log all available metadata keys
    console.log('Available metadata keys:', order.meta_data.map((meta: any) => meta.key));
    
    // Log specific fields we're looking for with exact key matches
    const fotosGarantiaField = order.meta_data.find((meta: any) => 
      meta.key === '_fotos_garantia' || 
      meta.key === 'fotos_garantia' || 
      meta.key === '_photos_warranty' ||
      meta.key.toLowerCase().includes('foto') ||
      meta.key.toLowerCase().includes('photo')
    );
    
    const correoEnviadoField = order.meta_data.find((meta: any) => 
      meta.key === '_correo_enviado' || 
      meta.key === 'correo_enviado' ||
      meta.key === '_email_sent' ||
      meta.key.toLowerCase().includes('correo') ||
      meta.key.toLowerCase().includes('email')
    );
    
    const pagoCompletoField = order.meta_data.find((meta: any) => 
      meta.key === '_pago_completo' || 
      meta.key === 'pago_completo' ||
      meta.key === '_payment_complete' ||
      meta.key.toLowerCase().includes('pago') ||
      meta.key.toLowerCase().includes('payment')
    );
    
    console.log('Fotos Garantia Field:', fotosGarantiaField);
    console.log('Correo Enviado Field:', correoEnviadoField);
    console.log('Pago Completo Field:', pagoCompletoField);

    // Create a response with the order details and the additional fields
    const extendedOrder = {
      id: order.id,
      status: order.status,
      date_created: order.date_created,
      date_modified: order.date_modified,
      customer_id: order.customer_id,
      billing: order.billing,
      metadata: {
        order_fecha_inicio: order.meta_data.find((meta: any) => meta.key === 'order_fecha_inicio')?.value || '',
        order_fecha_termino: order.meta_data.find((meta: any) => meta.key === 'order_fecha_termino')?.value || '',
        num_jornadas: order.meta_data.find((meta: any) => meta.key === 'num_jornadas')?.value || '',
        calculated_subtotal: order.meta_data.find((meta: any) => meta.key === 'calculated_subtotal')?.value || '',
        calculated_discount: order.meta_data.find((meta: any) => meta.key === 'calculated_discount')?.value || '',
        calculated_iva: order.meta_data.find((meta: any) => meta.key === 'calculated_iva')?.value || '',
        calculated_total: order.meta_data.find((meta: any) => meta.key === 'calculated_total')?.value || '',
        company_rut: order.meta_data.find((meta: any) => meta.key === 'company_rut')?.value || '',
        order_proyecto: order.meta_data.find((meta: any) => meta.key === 'order_proyecto')?.value || '',
        pdf_on_hold_url: order.meta_data.find((meta: any) => meta.key === '_pdf_on_hold_url')?.value || '',
        pdf_processing_url: order.meta_data.find((meta: any) => meta.key === '_pdf_processing_url')?.value || '',
        fotos_garantia: fotosGarantiaField?.value || [],
        cantidad_fotos: Array.isArray(fotosGarantiaField?.value) ? fotosGarantiaField.value.length : 0,
        correo_enviado: (() => {
          const value = correoEnviadoField?.value;
          return value === 'true' || value === '1' || value === 'yes' || value === true;
        })(),
        pago_completo: (() => {
          const value = pagoCompletoField?.value;
          return value === 'true' || value === '1' || value === 'yes' || value === true;
        })()
      },
      line_items: order.line_items
    };

    // Log the final transformed metadata
    console.log('Transformed Metadata:', JSON.stringify(extendedOrder.metadata, null, 2));

    return new Response(JSON.stringify({
      success: true,
      message: 'Orden extendida obtenida exitosamente',
      data: extendedOrder
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error: any) {
    console.error('Error al obtener la orden:', error);
    
    const errorDetails = {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    };
    
    console.error('Detalles del error:', JSON.stringify(errorDetails, null, 2));

    return new Response(JSON.stringify({
      success: false,
      message: 'Error al obtener la orden',
      error: error.message,
      details: errorDetails
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}
