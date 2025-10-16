import type { APIRoute } from 'astro';
import { CategoryService } from '../../../services/categoryService';
import { withAuth } from '../../../middleware/auth';
// withCors removed - global middleware handles CORS

export const GET: APIRoute = withAuth(async (context) => {
  try {
    const categoryId = parseInt(context.params.id as string);

    if (isNaN(categoryId)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de categoría inválido'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const category = await CategoryService.getCategoryById(categoryId);

    if (!category) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Categoría no encontrada'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: category
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in GET /api/categories/[id]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al obtener la categoría'
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
    const categoryId = parseInt(context.params.id as string);
    const updates = await context.request.json();

    if (isNaN(categoryId)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de categoría inválido'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Verificar que la categoría existe
    const existingCategory = await CategoryService.getCategoryById(categoryId);
    if (!existingCategory) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Categoría no encontrada'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const updatedCategory = await CategoryService.updateCategory(categoryId, {
      ...updates,
      date_modified: new Date().toISOString()
    });

    return new Response(JSON.stringify({
      success: true,
      data: updatedCategory
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in PUT /api/categories/[id]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al actualizar la categoría'
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
    const categoryId = parseInt(context.params.id as string);

    if (isNaN(categoryId)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de categoría inválido'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Verificar que la categoría existe
    const existingCategory = await CategoryService.getCategoryById(categoryId);
    if (!existingCategory) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Categoría no encontrada'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    await CategoryService.deleteCategory(categoryId);

    return new Response(JSON.stringify({
      success: true,
      message: 'Categoría eliminada correctamente'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in DELETE /api/categories/[id]:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al eliminar la categoría'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});

// OPTIONS handler removed - handled by global middleware
