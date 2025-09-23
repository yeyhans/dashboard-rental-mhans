import type { APIRoute } from 'astro';
import { ProductService } from '../../../services/productService';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Parse query parameters
    const searchParams = new URL(request.url).searchParams;
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '1000', 10); // Increased default limit to show all products
    const categoryIdString = searchParams.get('category');
    const categoryId = categoryIdString ? parseInt(categoryIdString, 10) : undefined;

    // Use ProductService to search products
    const result = await ProductService.searchProducts(search, page, limit, categoryId);

    return new Response(JSON.stringify({
      success: true,
      data: {
        products: result.products || [],
        total: result.total || 0,
        page: result.page || 1,
        limit: result.limit || limit,
        totalPages: result.totalPages || 1
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Error searching products:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Error al buscar productos',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
