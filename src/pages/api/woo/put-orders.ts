import type { APIRoute } from 'astro';
import WooCommerce from './apiroute';

const validStatuses = [
  'pending',
  'processing',
  'on-hold',
  'completed',
  'cancelled',
  'refunded',
  'failed',
  'checkout-draft',
  'trash',
  'auto-draft'
];

const expectedMetaKeys = [
  'order_fecha_inicio',
  'order_fecha_termino',
  'num_jornadas',
  'calculated_subtotal',
  'calculated_discount',
  'calculated_iva',
  'calculated_total',
  'company_rut',
  'order_proyecto',
  '_pdf_on_hold_url',
  '_pdf_processing_url'
];

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    
    // Validación básica
    if (!body.customer_id) throw new Error('customer_id es requerido');
    if (!body.billing) throw new Error('billing es requerido');
    if (!body.line_items?.length) throw new Error('line_items es requerido');

    // Construir payload para WooCommerce
    const wcOrder: any = {
      customer_id: body.customer_id,
      status: validStatuses.includes(body.status) ? body.status : 'pending',
      billing: body.billing,
      line_items: body.line_items.map((item: any) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        sku: item.sku,
        price: item.price,
        name: item.name
      })),
      meta_data: expectedMetaKeys
        .filter(key => body.metadata?.[key])
        .map(key => ({ key, value: body.metadata[key] }))
    };

    // Crear orden en WooCommerce
    const response = await WooCommerce.post('orders', wcOrder);

    // Transformar respuesta
    const transformedOrder = {
      id: response.data.id,
      status: response.data.status,
      date_created: response.data.date_created,
      date_modified: response.data.date_modified,
      customer_id: response.data.customer_id,
      billing: {
        first_name: response.data.billing.first_name,
        last_name: response.data.billing.last_name,
        company: response.data.billing.company,
        address_1: response.data.billing.address_1,
        city: response.data.billing.city,
        email: response.data.billing.email,
        phone: response.data.billing.phone
      },
      metadata: Object.fromEntries(
        expectedMetaKeys.map(key => [
          key,
          response.data.meta_data.find((meta: any) => meta.key === key)?.value || ''
        ])
      ),
      line_items: response.data.line_items.map((item: any) => ({
        name: item.name,
        product_id: item.product_id,
        sku: item.sku,
        price: item.price,
        quantity: item.quantity,
        image: item.image?.src || ''
      }))
    };

    return new Response(JSON.stringify({
      success: true,
      message: 'Orden creada exitosamente',
      data: transformedOrder
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    const errorDetails = {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    };

    return new Response(JSON.stringify({
      success: false,
      message: 'Error al crear la orden',
      error: errorDetails
    }), {
      status: error.response?.status || 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};