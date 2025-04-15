import type { APIRoute } from "astro";
import WooCommerce from "../apiroute";
import { supabase } from "../../../../lib/supabase";

export const POST: APIRoute = async ({ params, request }) => {
  try {
    // Verificar autenticación
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "No autorizado. Debe iniciar sesión para realizar esta acción."
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }
    
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

    // Obtener los datos enviados en la solicitud
    const productData = await request.json();

    // Validar que haya datos para actualizar
    if (!productData || Object.keys(productData).length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "No se proporcionaron datos para actualizar el producto"
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    // Preparar los datos para actualizar en WooCommerce
    // Solo incluimos los campos que son permitidos por la API de WooCommerce
    const updateData: Record<string, any> = {};
    
    // Campos principales
    if (productData.name !== undefined) updateData.name = productData.name;
    if (productData.slug !== undefined) updateData.slug = productData.slug;
    if (productData.status !== undefined) updateData.status = productData.status;
    if (productData.description !== undefined) updateData.description = productData.description;
    if (productData.short_description !== undefined) updateData.short_description = productData.short_description;
    if (productData.sku !== undefined) updateData.sku = productData.sku;
    if (productData.price !== undefined) updateData.price = productData.price;
    if (productData.regular_price !== undefined) updateData.regular_price = productData.regular_price;
    if (productData.sale_price !== undefined) updateData.sale_price = productData.sale_price;
    if (productData.stock_quantity !== undefined) updateData.stock_quantity = productData.stock_quantity;
    if (productData.stock_status !== undefined) updateData.stock_status = productData.stock_status;
    
    // Categorías (si se envían)
    if (productData.categories) {
      updateData.categories = productData.categories.map((cat: any) => {
        // Si solo se envía el ID, creamos un objeto con el ID
        if (typeof cat === 'number') {
          return { id: cat };
        }
        // Si se envía un objeto, aseguramos que tenga al menos el ID
        if (cat.id) {
          return { id: cat.id };
        }
        return null;
      }).filter(Boolean); // Eliminar posibles valores nulos
    }
    
    // Imágenes (si se envían)
    if (productData.images) {
      updateData.images = productData.images.map((img: any) => {
        if (typeof img === 'number') {
          return { id: img };
        }
        if (img.id) {
          return { id: img.id, src: img.src, alt: img.alt };
        }
        if (img.src) {
          return { src: img.src, alt: img.alt || '' };
        }
        return null;
      }).filter(Boolean);
    }

    // Actualizar producto en WooCommerce
    // Usamos as any para solucionar el problema de tipado con la API de WooCommerce
    const response = await WooCommerce.put(`products/${id}` as any, updateData);
    
    // Transformar la respuesta para mantener consistencia con el formato de datos
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
        message: "Producto actualizado exitosamente",
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
    console.error("Error actualizando producto:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : "Error al actualizar el producto"
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