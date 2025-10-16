import type { APIRoute } from 'astro';
import { CategoryService } from '../../../services/categoryService';
import { withAuth } from '../../../middleware/auth';
// withCors removed - global middleware handles CORS

// GET is public - no auth required for category listing
export const GET: APIRoute = async (context) => {
  try {
    const url = new URL(context.request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search');
    const hierarchical = url.searchParams.get('hierarchical') === 'true';

    let result;

    if (search) {
      result = await CategoryService.searchCategories(search, page, limit);
    } else if (hierarchical) {
      result = await CategoryService.getCategoriesHierarchy();
    } else {
      result = await CategoryService.getAllCategories(page, limit);
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
    console.error('Error in GET /api/categories:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al obtener las categorías'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};

// POST requires admin authentication
export const POST: APIRoute = withAuth(async (context) => {
  try {
    const categoryData = await context.request.json();

    // Validaciones básicas
    if (!categoryData.name) {
      return new Response(JSON.stringify({
        success: false,
        error: 'name es requerido'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const category = await CategoryService.createCategory({
      ...categoryData,
      date_created: new Date().toISOString(),
      date_modified: new Date().toISOString()
    });

    return new Response(JSON.stringify({
      success: true,
      data: category
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in POST /api/categories:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al crear la categoría'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});

// OPTIONS handler removed - handled by global middleware
