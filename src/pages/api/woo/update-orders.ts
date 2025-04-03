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

export const PUT: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    
    if (!body.id) throw new Error('ID de orden es requerido');
    
    // Construir payload para actualización
    const updateData: any = {};
    
    if (body.status) {
      if (!validStatuses.includes(body.status)) throw new Error('Estado inválido');
      updateData.status = body.status;
    }
    
    if (body.billing) updateData.billing = body.billing;
    
    if (body.metadata) {
      updateData.meta_data = [
        ...expectedMetaKeys
          .filter(key => body.metadata[key])
          .map(key => ({ key, value: body.metadata[key] })),
        
        ...(body.metadata.customMeta || []).map((meta: any) => ({
          key: meta.key,
          value: meta.value
        }))
      ];
    }
    
    if (body.line_items) {
      updateData.line_items = body.line_items
        // Filtrar cualquier item inválido
        .filter((item: any) => item && (item.id || item.product_id))
        .map((item: any) => {
          // Si el item tiene ID y cantidad 0, marcarlo para eliminación
          if (item.id && item.quantity === 0) {
            return {
              id: item.id,
              quantity: 0
            };
          }
          // Si el item tiene ID, actualizarlo
          else if (item.id) {
            return {
              id: item.id,
              quantity: item.quantity
            };
          }
          // Si es un item nuevo, agregarlo
          else {
            return {
              product_id: item.product_id,
              quantity: item.quantity
            };
          }
        });
    }

    console.log('Actualizando orden con:', JSON.stringify(updateData, null, 2));

    // Actualizar orden en WooCommerce
    const response = await WooCommerce.put(`orders/${body.id}` as any, updateData);

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
      message: 'Orden actualizada exitosamente',
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
      message: 'Error al actualizar la orden',
      error: errorDetails
    }), {
      status: error.response?.status || 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};