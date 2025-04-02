import type { APIRoute } from 'astro';
import WooCommerce from './apiroute';

// Valid order statuses
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

export const GET: APIRoute = async ({ request }) => {
  try {
    // Get URL parameters
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const per_page = url.searchParams.get('per_page') || '10';
    const status = url.searchParams.get('status') || '';
    const customer = url.searchParams.get('customer') || '';

    // Build query parameters
    const params: any = {
      page,
      per_page
    };

    // Add status filter if provided and valid
    if (status && validStatuses.includes(status)) {
      params.status = status;
    }

    // Add customer filter if provided
    if (customer) {
      params.customer = customer;
    }

    // Fetch orders from WooCommerce
    const response = await WooCommerce.get('orders', params);

    // Transform the orders data to include only specified fields
    const transformedOrders = response.data.map((order: any) => ({
      id: order.id,
      status: order.status,
      date_created: order.date_created,
      date_modified: order.date_modified,
      customer_id: order.customer_id,
      billing: {
        first_name: order.billing.first_name,
        last_name: order.billing.last_name,
        company: order.billing.company,
        address_1: order.billing.address_1,
        city: order.billing.city,
        email: order.billing.email,
        phone: order.billing.phone
      },
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
        pdf_processing_url: order.meta_data.find((meta: any) => meta.key === '_pdf_processing_url')?.value || ''
      },
      line_items: order.line_items.map((item: any) => ({
        name: item.name,
        product_id: item.product_id,
        sku: item.sku,
        price: item.price,
        quantity: item.quantity,
        image: item.image?.src || ''
      }))
    }));

    return new Response(JSON.stringify({
      success: true,
      message: 'Órdenes obtenidas exitosamente',
      data: {
        orders: transformedOrders,
        total: response.headers['x-wp-total'],
        totalPages: response.headers['x-wp-totalpages']
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error: any) {
    console.error('Error al obtener órdenes:', error);
    
    const errorDetails = {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    };
    
    console.error('Detalles del error:', JSON.stringify(errorDetails, null, 2));

    return new Response(JSON.stringify({
      success: false,
      message: 'Error al obtener las órdenes',
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