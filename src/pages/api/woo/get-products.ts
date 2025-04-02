import type { APIRoute } from 'astro';
import WooCommerce from './apiroute';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Get URL parameters
    const url = new URL(request.url);
    const category = url.searchParams.get('category') || '';
    const search = url.searchParams.get('search') || '';

    // Build base query parameters
    const baseParams: any = {
      per_page: 100 // Maximum items per page
    };

    // Add category filter if provided
    if (category) {
      baseParams.category = category;
    }

    // Add search filter if provided
    if (search) {
      baseParams.search = search;
    }

    // Function to fetch all products recursively
    const fetchAllProducts = async (page = 1, allProducts: any[] = []): Promise<any[]> => {
      const params = { ...baseParams, page };
      const response = await WooCommerce.get('products', params);
      
      const currentProducts = response.data;
      const totalPages = parseInt(response.headers['x-wp-totalpages'] || '1');
      
      // Transform the current page products with only the specified fields
      const transformedProducts = currentProducts.map((product: any) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        status: product.status,
        short_description: product.short_description,
        sku: product.sku,
        price: product.price,
        stock_status: product.stock_status,
        categories: product.categories.map((category: any) => ({
          id: category.id,
          name: category.name,
          slug: category.slug
        })),
        images: product.images.map((image: any) => ({
          id: image.id,
          src: image.src,
          alt: image.alt
        }))
      }));

      const newProducts = [...allProducts, ...transformedProducts];

      // If there are more pages, fetch them recursively
      if (page < totalPages) {
        return fetchAllProducts(page + 1, newProducts);
      }

      return newProducts;
    };

    // Start fetching all products
    const allProducts = await fetchAllProducts();

    return new Response(JSON.stringify({
      success: true,
      message: 'Todos los productos obtenidos exitosamente',
      data: {
        products: allProducts,
        total: allProducts.length
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error: any) {
    console.error('Error al obtener productos:', error);
    
    const errorDetails = {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    };
    
    console.error('Detalles del error:', JSON.stringify(errorDetails, null, 2));

    return new Response(JSON.stringify({
      success: false,
      message: 'Error al obtener los productos',
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
