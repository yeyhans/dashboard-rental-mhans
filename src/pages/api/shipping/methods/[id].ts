import type { APIRoute } from 'astro';
import { withAuth } from '../../../../middleware/auth';
import { ShippingService } from '../../../../services/shippingService';

// Todos los handlers exigen sesión de admin: el middleware global solo resuelve CORS para /api/*,
// no autentica. El DELETE es especialmente sensible porque
// `shipping_usage_shipping_method_id_fkey` es ON DELETE CASCADE: borrar un método borra además
// todo su historial de envíos.
export const GET: APIRoute = withAuth(async ({ params }) => {
  try {
    const methodId = parseInt(params.id as string);
    
    if (isNaN(methodId)) {
      return new Response(JSON.stringify({ 
        error: 'ID de método de envío inválido' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const method = await ShippingService.getShippingMethodById(methodId);
    
    if (!method) {
      return new Response(JSON.stringify({ 
        error: 'Método de envío no encontrado' 
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    return new Response(JSON.stringify(method), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[GET /api/shipping/methods/:id] Error al obtener método de envío:', error);
    return new Response(JSON.stringify({
      error: 'Error al obtener método de envío'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

export const PUT: APIRoute = withAuth(async ({ params, request }) => {
  try {
    const methodId = parseInt(params.id as string);
    
    if (isNaN(methodId)) {
      return new Response(JSON.stringify({ 
        error: 'ID de método de envío inválido' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const body = await request.json();
    const updatedMethod = await ShippingService.updateShippingMethod(methodId, body);

    return new Response(JSON.stringify(updatedMethod), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[PUT /api/shipping/methods/:id] Error al actualizar método de envío:', error);

    if (error instanceof Error && error.message.includes('no encontrado')) {
      return new Response(JSON.stringify({ 
        error: 'Método de envío no encontrado' 
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    return new Response(JSON.stringify({
      error: 'Error al actualizar método de envío'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

export const DELETE: APIRoute = withAuth(async ({ params }) => {
  try {
    const methodId = parseInt(params.id as string);
    
    if (isNaN(methodId)) {
      return new Response(JSON.stringify({ 
        error: 'ID de método de envío inválido' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const success = await ShippingService.deleteShippingMethod(methodId);
    
    if (!success) {
      return new Response(JSON.stringify({ 
        error: 'No se pudo eliminar el método de envío' 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Método de envío eliminado exitosamente' 
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[DELETE /api/shipping/methods/:id] Error al eliminar método de envío:', error);

    if (error instanceof Error && error.message.includes('no encontrado')) {
      return new Response(JSON.stringify({ 
        error: 'Método de envío no encontrado' 
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    return new Response(JSON.stringify({
      error: 'Error al eliminar método de envío'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});
