import type { APIRoute } from 'astro';
import { ProductService } from '../../../services/productService';
import { withAuth, withCors } from '../../../middleware/auth';

export const GET: APIRoute = withCors(withAuth(async (context) => {
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

    const product = await ProductService.getProductById(productId);

    if (!product) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Producto no encontrado'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: product
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in GET /api/products/[id]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al obtener el producto'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}));

export const PUT: APIRoute = withCors(withAuth(async (context) => {
  try {
    const productId = parseInt(context.params.id as string);
    const updates = await context.request.json();

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

    // Verificar que el producto existe
    const existingProduct = await ProductService.getProductById(productId);
    if (!existingProduct) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Producto no encontrado'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const updatedProduct = await ProductService.updateProduct(productId, {
      ...updates,
      updated_at: new Date().toISOString()
    });

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
    console.error('Error in PUT /api/products/[id]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al actualizar el producto'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}));

export const DELETE: APIRoute = withCors(withAuth(async (context) => {
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

    // Verificar que el producto existe
    const existingProduct = await ProductService.getProductById(productId);
    if (!existingProduct) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Producto no encontrado'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    await ProductService.deleteProduct(productId);

    return new Response(JSON.stringify({
      success: true,
      message: 'Producto eliminado correctamente'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in DELETE /api/products/[id]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al eliminar el producto'
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
