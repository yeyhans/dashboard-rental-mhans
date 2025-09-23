import type { APIRoute } from 'astro';
import { CategoryService } from '../../../services/categoryService';
import { withAuth, withCors } from '../../../middleware/auth';

export const PUT: APIRoute = withCors(withAuth(async (context) => {
  try {
    const { categoryOrders } = await context.request.json();

    if (!categoryOrders || !Array.isArray(categoryOrders)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'categoryOrders debe ser un array'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Validar que cada elemento tenga id y menu_order
    for (const item of categoryOrders) {
      if (!item.id || item.menu_order === undefined) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Cada elemento debe tener id y menu_order'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
    }

    const result = await CategoryService.reorderCategories(categoryOrders);

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
    console.error('Error in PUT /api/categories/reorder:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al reordenar las categorías'
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
