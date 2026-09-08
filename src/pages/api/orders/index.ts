import type { APIRoute } from 'astro';
import { OrderService } from '../../../services/orderService';
import { withAuth } from '../../../middleware/auth';
import { isFrontendApiKeyOrAdmin, unauthorizedResponse } from '../../../lib/serverApiAuth';
import { ORDER_STATUSES, canonicalStatus } from '../../../lib/orderStatus';

export const GET: APIRoute = withAuth(async (context) => {
  try {
    const url = new URL(context.request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const status = url.searchParams.get('status') || undefined;
    const search = url.searchParams.get('search');
    const userId = url.searchParams.get('userId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    let result;

    if (search) {
      result = await OrderService.searchOrders(search, page, limit);
    } else if (userId) {
      result = await OrderService.getOrdersByUser(parseInt(userId), page, limit);
    } else if (startDate && endDate) {
      result = await OrderService.getOrdersByDateRange(startDate, endDate, page, limit);
    } else {
      result = await OrderService.getAllOrders(page, limit, status);
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
    console.error('Error in GET /api/orders:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al obtener las órdenes'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});

export const POST: APIRoute = async (context) => {
  const origin = context.request.headers.get('origin') || 'http://localhost:4321';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie, X-API-Key, X-Request-ID'
  };

  if (!(await isFrontendApiKeyOrAdmin(context))) {
    return unauthorizedResponse(corsHeaders);
  }
   
  try {
    console.log('📦 POST /api/orders - Creating order from frontend');
    
    const orderData = await context.request.json();

    // Validaciones básicas
    if (!orderData.customer_id || !orderData.billing_email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'customer_id y billing_email son requeridos'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Normalizacion de vocabulario. Este endpoint es la costura entre los dos repositorios: el
    // frontend de clientes crea aqui cada reserva y su `backendOrderService.ts` manda
    // `status: 'on-hold'` por defecto. La migracion 0003 saca `on-hold` del CHECK, asi que en el
    // instante en que se aplique ese insert empieza a fallar y ningun cliente puede reservar.
    //
    // Se arregla aca y no en el frontend a proposito: alla exigiria que el despliegue y el apply
    // de la migracion cayeran en el mismo instante — adelantar el cambio a `request` hace que el
    // CHECK viejo lo rechace, el mismo corte en espejo. Normalizando en el servidor los dos
    // ordenes de eventos son seguros y cada repositorio despliega cuando quiera.
    const requestedStatus = orderData.status ?? 'request';
    const normalizedStatus = canonicalStatus(requestedStatus);

    if (!normalizedStatus) {
      // No se cae por defecto a `request`: `paid`, `reviewing`, `preparing` y `delivering`
      // aparecen en la documentacion y en el timeline del frontend, pero ningun CHECK los admitio
      // nunca. Convertirlos en silencio esconderia un bug real del llamador detras de un 201.
      console.error('[POST /api/orders] Estado desconocido en la creacion:', {
        status: requestedStatus,
        customerId: orderData.customer_id,
      });
      return new Response(JSON.stringify({
        success: false,
        error: `Estado inválido: "${requestedStatus}". Debe ser uno de: ${ORDER_STATUSES.join(', ')}`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (normalizedStatus !== requestedStatus) {
      console.log('[POST /api/orders] Estado legado normalizado:', {
        recibido: requestedStatus,
        persistido: normalizedStatus,
      });
    }

    console.log('✅ Order data validated:', {
      customer_id: orderData.customer_id,
      billing_email: orderData.billing_email,
      status: normalizedStatus
    });

    const order = await OrderService.createOrder({
      ...orderData,
      date_created: new Date().toISOString(),
      date_modified: new Date().toISOString(),
      status: normalizedStatus
    });

    console.log('✅ Order created successfully:', order.id);
    console.log('📋 PDF generation will be handled by frontend via /api/orders/:id/generate-budget');

    return new Response(JSON.stringify({
      success: true,
      data: order
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('❌ Error in POST /api/orders:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al crear la orden'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
};

// OPTIONS handler for CORS preflight
// Even with global middleware, Astro endpoints need explicit OPTIONS export
export const OPTIONS: APIRoute = async ({ request }) => {
  const origin = request.headers.get('origin') || 'http://localhost:4321';
  
  console.log('✅ OPTIONS /api/orders - CORS preflight from:', origin);
  
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie, X-API-Key, X-Request-ID',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    },
  });
};
