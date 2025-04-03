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

    console.log("Received update payload:", JSON.stringify(body, null, 2));

    // Prepare the WooCommerce update payload
    const wcUpdatePayload: any = {};

    // Get current order to compare line items
    const currentOrderResponse = await WooCommerce.get(`orders/${id}` as 'orders');
    const currentOrder = currentOrderResponse.data;
    const currentLineItems = currentOrder.line_items || [];

    // Handle line items if present
    if (body.line_items) {
      // Create a map of current line item IDs for easy lookup
      const currentLineItemIds = new Set(currentLineItems.map((item: any) => item.id));
      
      // Prepare line_items array for WooCommerce
      wcUpdatePayload.line_items = [];
      
      // Process line items to update or keep
      for (const item of body.line_items) {
        if (item.id) {
          // This is an existing item, update it
          wcUpdatePayload.line_items.push({
            id: item.id,
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price
          });
          // Remove from current IDs set
          currentLineItemIds.delete(item.id);
        } else {
          // This is a new item, add it
          wcUpdatePayload.line_items.push({
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price
          });
        }
      }
      
      // Any IDs left in the set are items to be removed
      for (const idToRemove of currentLineItemIds) {
        wcUpdatePayload.line_items.push({
          id: idToRemove,
          quantity: 0  // Setting quantity to 0 removes the item
        });
      }
    }

    // Handle billing information if present
    if (body.billing) {
      wcUpdatePayload.billing = body.billing;
    }

    // Handle metadata if present
    if (body.meta_data || body.metadata) {
      // El cliente puede enviar metadata como un objeto plano o como un array de {key, value}
      let metaSource = body.meta_data || body.metadata;
      wcUpdatePayload.meta_data = [];
      
      console.log("Metadata received:", metaSource);
      
      // Verificar si el metadata es un array (formato antiguo) o un objeto (nuevo formato)
      if (Array.isArray(metaSource)) {
        // Convertir array a objeto para facilitar el procesamiento
        const metaObj: {[key: string]: any} = {};
        metaSource.forEach((item: any) => {
          if (item && item.key) {
            metaObj[item.key] = item.value;
          }
        });
        metaSource = metaObj;
      }
      
      // Procesar cada clave esperada
      for (const key of expectedMetaKeys) {
        // Check if the key exists in the payload
        if (key in metaSource) {
          let value = metaSource[key];
          
          // Ensure numeric values are sent as strings to avoid WooCommerce API issues
          if (typeof value === 'number') {
            value = value.toString();
          }
          
          // Si las fechas vienen en formato yyyy-mm-dd, asegurarse de que sea compatible con WooCommerce
          if ((key === 'order_fecha_inicio' || key === 'order_fecha_termino') && value) {
            // Asegurar que la fecha sea string y esté en el formato correcto
            value = value.toString();
            
            // Validar el formato de fecha
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(value)) {
              console.warn(`Fecha en formato incorrecto: ${key}=${value}`);
            } else {
              console.log(`Procesando fecha ${key}: ${value}`);
            }
          }
          
          wcUpdatePayload.meta_data.push({
            key,
            value
          });
        }
      }
      
      console.log("Processed metadata for WooCommerce:", wcUpdatePayload.meta_data);
    }

    console.log("Sending to WooCommerce:", JSON.stringify(wcUpdatePayload, null, 2));

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
        expectedMetaKeys.map(key => {
          // Buscar el valor actualizado en los metadatos de la respuesta
          const metaItem = response.data.meta_data.find((meta: any) => meta.key === key);
          
          // Usar el valor enviado si no existe en la respuesta (para claves nuevas)
          let value = metaItem?.value || '';
          
          // Si el valor existe en el payload original y no en la respuesta, usar el del payload
          if (!value && body.metadata && body.metadata[key]) {
            value = body.metadata[key];
            console.log(`Usando valor del payload para ${key}: ${value}`);
          }
          
          return [key, value];
        })
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
  } catch (error: any) {
    console.error("Error updating order:", error);
    
    // More detailed error logging
    const errorData = {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : null,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : null
    };
    
    console.error("Detailed error:", JSON.stringify(errorData, null, 2));
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : "Error al actualizar el pedido",
        details: errorData
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