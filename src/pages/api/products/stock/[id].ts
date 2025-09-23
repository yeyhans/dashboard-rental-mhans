import type { APIRoute } from 'astro';
import { ProductService } from '../../../../services/productService';
import { withAuth, withCors } from '../../../../middleware/auth';

export const PUT: APIRoute = withCors(withAuth(async (context) => {
  try {
    const productId = parseInt(context.params.id as string);
    const { stock_quantity, manage_stock } = await context.request.json();

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

    if (stock_quantity === undefined) {
      return new Response(JSON.stringify({
        success: false,
        error: 'stock_quantity es requerido'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const updatedProduct = await ProductService.updateStock(productId, stock_quantity, manage_stock);

    return new Response(JSON.stringify({
      success: true,
      data: updatedProduct
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in PUT /api/products/stock/[id]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al actualizar el stock del producto'
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
