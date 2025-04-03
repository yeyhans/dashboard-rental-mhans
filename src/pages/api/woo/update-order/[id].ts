import type { APIRoute } from "astro";
import WooCommerce from "../apiroute";

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

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;
    const body = await request.json();

    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "ID de pedido no proporcionado"
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    // Prepare the WooCommerce update payload
    const wcUpdatePayload: any = {};

    // Handle line items if present
    if (body.line_items) {
      wcUpdatePayload.line_items = body.line_items.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price
      }));
    }

    // Handle billing information if present
    if (body.billing) {
      wcUpdatePayload.billing = body.billing;
    }

    // Handle metadata if present
    if (body.meta_data || body.metadata) {
      wcUpdatePayload.meta_data = expectedMetaKeys
        .filter(key => (body.meta_data?.[key] || body.metadata?.[key]))
        .map(key => ({
          key,
          value: body.meta_data?.[key] || body.metadata?.[key]
        }));
    }

    // Update the order in WooCommerce
    const response = await WooCommerce.put(`orders/${id}` as 'orders', wcUpdatePayload);

    // Transform the response to match our Order type
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
        id: item.id,
        name: item.name,
        product_id: item.product_id,
        sku: item.sku,
        price: item.price,
        quantity: item.quantity,
        image: item.image?.src || ''
      }))
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: transformedOrder
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error("Error updating order:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : "Error al actualizar el pedido"
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
}; 