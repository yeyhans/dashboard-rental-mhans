import type { APIRoute } from 'astro';
import { ProductService } from '../../../services/productService';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '1000');
    
    // Get active products for order editing
    const result = await ProductService.getAllProducts(1, limit, false);

    return new Response(JSON.stringify({
      success: true,
      data: {
        products: result.products.map((product: any) => ({
          id: product.id,
          name: product.name,
          price: product.price,
          sku: product.sku,
          stock_quantity: product.stock_quantity,
          featured_image_url: product.featured_image_url
        }))
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error) {
    console.error('Error in GET /api/products/simple:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al obtener los productos'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
};
