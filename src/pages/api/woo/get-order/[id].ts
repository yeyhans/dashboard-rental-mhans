import type { APIRoute } from "astro";
import WooCommerce from "../apiroute";

export const GET: APIRoute = async ({ params, request }) => {
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

    // Using "as any" to handle the type issue with the templated string
    const response = await WooCommerce.get(`orders/${id}` as any);

    return new Response(
      JSON.stringify({
        success: true,
        data: response.data
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
        message: error instanceof Error ? error.message : "Error al obtener el pedido"
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