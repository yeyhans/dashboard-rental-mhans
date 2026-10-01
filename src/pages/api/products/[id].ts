import type { APIRoute } from 'astro';
import { parseValuationUpdates } from '../../../lib/productValuation';
import { ProductService } from '../../../services/productService';
import { withAuth } from '../../../middleware/auth';
// withCors removed - global middleware handles CORS

export const GET: APIRoute = withAuth(async (context) => {
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
});

export const PUT: APIRoute = withAuth(async (context) => {
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

    // Valuation fields (0010) are the one part of the body validated here: a negative or decimal
    // value would otherwise hit the CHECK constraint and surface as a bare 500. Only the keys
    // present are touched, blanks clear the value, and a derived `total_value_clp` is never
    // written — it is computed from quantity × used value and has no column.
    const { total_value_clp: _ignoredTotal, ...forwarded } = updates as Record<string, unknown>;
    const valuation = parseValuationUpdates(forwarded);
    if (valuation.error) {
      return new Response(JSON.stringify({
        success: false,
        error: valuation.error
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const updatedProduct = await ProductService.updateProduct(productId, {
      ...forwarded,
      ...valuation.values,
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
});

export const DELETE: APIRoute = withAuth(async (context) => {
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
});

// OPTIONS handler removed - handled by global middleware
