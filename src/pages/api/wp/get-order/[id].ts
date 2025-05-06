import type { APIRoute } from "astro";

interface WPOrder {
  id: number;
  status: string;
  date_created: string;
  total: string;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
  };
  fotos_garantia: string[];
  correo_enviado: boolean;
  pago_completo: string;
}


export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;

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

    const username = import.meta.env.WORDPRESS_USERNAME;
    const password = import.meta.env.WORDPRESS_PASSWORD;
    const wpUrl = import.meta.env.WOOCOMMERCE_STORE_URL;

    if (!username || !password || !wpUrl) {
      throw new Error('WordPress credentials or URL are not configured');
    }

    // Build the WordPress API URL for a single order
    const wpApiUrl = new URL(`${wpUrl}/wp-json/custom/v1/orders`);
    wpApiUrl.searchParams.set('order_id', id);
    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    console.log('=== Debug Info Get Order ===');
    console.log('Request URL:', wpApiUrl.toString());
    console.log('Order ID:', id);

    console.log('Actualizando pedido en WordPress:', wpApiUrl.toString());
    const response = await fetch(wpApiUrl.toString(), {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });

    console.log('Response status:', response.status);
    console.log('Response status text:', response.statusText);

    if (!response.ok) {
      console.error('Error response headers:', Object.fromEntries(response.headers));
      return new Response(
        JSON.stringify({
          success: false,
          message: `Error al obtener el pedido: ${response.statusText}`
        }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const orderData = await response.json();
    console.log('Received order data:', JSON.stringify(orderData, null, 2));
    
    // Check if orderData is directly the order or contains an orders array
    const order = orderData.orders ? orderData.orders.find((order: WPOrder) => order.id === parseInt(id)) : orderData;
    
    if (!order) {
      console.error('Order not found in response. Full response:', JSON.stringify(orderData, null, 2));
      return new Response(
        JSON.stringify({
          success: false,
          message: `No se encontró el pedido con ID: ${id}`,
          debug: { receivedData: orderData }
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        orders: order
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error("Error fetching order:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : "Error al obtener el pedido",
        debug: { error: error instanceof Error ? error.stack : String(error) }
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