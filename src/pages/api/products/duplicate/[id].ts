import type { APIRoute } from 'astro';
import { ProductService } from '../../../../services/productService';
import { withAuth, withCors } from '../../../../middleware/auth';

export const POST: APIRoute = withCors(withAuth(async (context) => {
  try {
    const productId = parseInt(context.params.id as string);

    if (isNaN(productId)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de producto inválido'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const duplicatedProduct = await ProductService.duplicateProduct(productId);

    return new Response(JSON.stringify({
      success: true,
      data: duplicatedProduct
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in POST /api/products/duplicate/[id]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al duplicar el producto'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}));

export const OPTIONS: APIRoute = withCors(async () => {
  return new Response(null, { status: 200 });
});
