import type { APIRoute } from "astro";

export interface WPOrder {
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
  
export const PUT: APIRoute = async ({ params, request }) => {
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
  
      // Build the WordPress API URL for updating an order
      const wpApiUrl = new URL(`${wpUrl}/wp-json/custom/v1/orders/${id}`);
      const auth = Buffer.from(`${username}:${password}`).toString('base64');
  
      const body = await request.json();
      console.log('Datos recibidos para actualización:', body);
      if (!body || typeof body.pago_completo !== 'string') {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Datos de actualización no válidos"
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      }
  
      console.log('Actualizando pedido en WordPress:', wpApiUrl.toString());
      const response = await fetch(wpApiUrl.toString(), {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
  
      if (!response.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            message: `Error al actualizar el pedido: ${response.statusText}`
          }),
          {
            status: response.status,
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      }
  
      const updatedOrder = await response.json();
      console.log('Pedido actualizado:', updatedOrder);
      return new Response(
        JSON.stringify({
          success: true,
          order: updatedOrder
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
          message: error instanceof Error ? error.message : "Error al actualizar el pedido",
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
  }