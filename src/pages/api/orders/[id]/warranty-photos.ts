import type { APIRoute } from "astro";
import { withAuth } from "../../../../middleware/auth";
import { OrderService } from "../../../../services/orderService";

/**
 * Stores the warranty photo URLs of an order (`orders.fotos_garantia`) with the service role.
 * Requires an admin session: its only caller is the dashboard's `WarrantyPhotosService`, a
 * same-origin fetch that carries the admin cookie. It used to be public, with a wildcard CORS
 * preflight, so anyone could overwrite any order's warranty evidence.
 */
export const PUT: APIRoute = withAuth(async ({ params, request }) => {
  try {
    const orderId = params.id;

    if (!orderId || isNaN(Number(orderId))) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid order ID",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const body = await request.json();
    const { photoUrls } = body;

    if (!Array.isArray(photoUrls)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "photoUrls must be an array",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Validate URLs
    for (const url of photoUrls) {
      if (typeof url !== "string" || !url.startsWith("https://")) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "All photo URLs must be valid HTTPS URLs",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    // Update warranty photos
    const updatedOrder = await OrderService.updateWarrantyPhotos(
      Number(orderId),
      photoUrls,
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully updated warranty photos for order ${orderId}`,
        order: updatedOrder,
        totalPhotos: photoUrls.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error(
      "[PUT /api/orders/[id]/warranty-photos] Error al actualizar fotos de garantía:",
      { orderId: params.id, error },
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: "No se pudieron actualizar las fotos de garantía",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
