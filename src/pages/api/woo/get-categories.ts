import type { APIRoute } from 'astro';
import WooCommerce from './apiroute';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Get URL parameters
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const per_page = url.searchParams.get('per_page') || '100';
    const search = url.searchParams.get('search') || '';

    // Build query parameters
    const params: any = {
      page,
      per_page
    };

    // Add search filter if provided
    if (search) {
      params.search = search;
    }

    // Fetch categories from WooCommerce
    const response = await WooCommerce.get('products/categories', params);

    // Transform the categories data
    const transformedCategories = response.data.map((category: any) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      parent: category.parent,
      description: category.description,
      display: category.display,
      image: category.image ? {
        id: category.image.id,
        src: category.image.src,
        name: category.image.name,
        alt: category.image.alt
      } : null,
      menu_order: category.menu_order,
      count: category.count,
      _links: category._links
    }));

    return new Response(JSON.stringify({
      success: true,
      message: 'Categorías obtenidas exitosamente',
      data: {
        categories: transformedCategories,
        total: response.headers['x-wp-total'],
        totalPages: response.headers['x-wp-totalpages']
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error: any) {
    console.error('Error al obtener categorías:', error);
    
    const errorDetails = {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    };
    
    console.error('Detalles del error:', JSON.stringify(errorDetails, null, 2));

    return new Response(JSON.stringify({
      success: false,
      message: 'Error al obtener las categorías',
      error: error.message,
      details: errorDetails
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
} 