import type { APIRoute } from "astro";
import WooCommerce from "../apiroute";

export const GET: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "ID de producto no proporcionado"
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    // Fetch product from WooCommerce API
    const response = await WooCommerce.get(`products/${id}` as any);
    
    // Transform product data to match our format
    const transformedProduct = {
      id: response.data.id,
      name: response.data.name,
      slug: response.data.slug,
      status: response.data.status,
      description: response.data.description,
      short_description: response.data.short_description,
      sku: response.data.sku,
      price: response.data.price,
      stock_quantity: response.data.stock_quantity,
      stock_status: response.data.stock_status,
      categories: response.data.categories.map((category: any) => ({
        id: category.id,
        name: category.name,
        slug: category.slug
      })),
      images: response.data.images.map((image: any) => ({
        id: image.id,
        src: image.src,
        alt: image.alt
      }))
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: transformedProduct
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error("Error fetching product:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : "Error al obtener el producto"
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