import type { APIRoute } from 'astro';
import { withAuth } from '../../../../middleware/auth';
import { ShippingService } from '../../../../services/shippingService';

// Todos los handlers exigen sesión de admin: el middleware global solo resuelve CORS para /api/*,
// no autentica. Sin `withAuth` cualquiera podía crear o borrar métodos de envío, y el DELETE
// arrastra en cascada las filas de `shipping_usage`.
export const GET: APIRoute = withAuth(async ({ request }) => {
  try {
    const searchParams = new URL(request.url).searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const enabled = searchParams.get('enabled');
    const search = searchParams.get('search');

    let result;

    if (search) {
      result = await ShippingService.searchShippingMethods(search, page, limit);
    } else {
      const enabledFilter = enabled === 'true' ? true : enabled === 'false' ? false : undefined;
      result = await ShippingService.getAllShippingMethods(page, limit, enabledFilter);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[GET /api/shipping/methods] Error al obtener métodos de envío:', error);
    return new Response(JSON.stringify({
      error: 'Error al obtener métodos de envío'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});

export const POST: APIRoute = withAuth(async ({ request }) => {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.shipping_type || body.cost === undefined) {
      return new Response(JSON.stringify({ 
        error: 'Campos requeridos: name, shipping_type, cost' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const newMethod = await ShippingService.createShippingMethod(body);

    return new Response(JSON.stringify(newMethod), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[POST /api/shipping/methods] Error al crear método de envío:', error);
    return new Response(JSON.stringify({
      error: 'Error al crear método de envío'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});
