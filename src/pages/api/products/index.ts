import type { APIRoute } from 'astro';
import { ProductService } from '../../../services/productService';
import { withAuth, withCors } from '../../../middleware/auth';

export const GET: APIRoute = withCors(withAuth(async (context) => {
  try {
    const url = new URL(context.request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '1000');
    const categoryId = url.searchParams.get('categoryId');
    const status = url.searchParams.get('status') || undefined;
    const search = url.searchParams.get('search');
    const featured = url.searchParams.get('featured');

    let result;

    if (search) {
      result = await ProductService.searchProducts(search, page, limit);
    } else if (categoryId) {
      result = await ProductService.getProductsByCategory(parseInt(categoryId), page, limit);
    } else if (featured === 'true') {
      result = await ProductService.getFeaturedProducts(limit);
    } else {
      const includeInactive = status === 'all';
      result = await ProductService.getAllProducts(page, limit, includeInactive);
    }

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in GET /api/products:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al obtener los productos'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}));

export const POST: APIRoute = withCors(withAuth(async (context) => {
  try {
    const productData = await context.request.json();

    // Validaciones básicas
    if (!productData.name || !productData.price) {
      return new Response(JSON.stringify({
        success: false,
        error: 'name y price son requeridos'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const product = await ProductService.createProduct({
      ...productData,
      date_created: new Date().toISOString(),
      date_modified: new Date().toISOString(),
      status: productData.status || 'publish'
    });

    return new Response(JSON.stringify({
      success: true,
      data: product
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in POST /api/products:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al crear el producto'
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
