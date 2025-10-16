import type { APIRoute } from 'astro';
import { OrderService } from '../../../services/orderService';
import { withAuth } from '../../../middleware/auth';

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

    console.log('✅ Order data validated:', {
      customer_id: orderData.customer_id,
      billing_email: orderData.billing_email,
      status: orderData.status || 'on-hold'
    });

    const order = await OrderService.createOrder({
      ...orderData,
      date_created: new Date().toISOString(),
      date_modified: new Date().toISOString(),
      status: orderData.status || 'on-hold'
    });

    console.log('✅ Order created successfully:', order.id);

    // Auto-generate budget PDF for on-hold orders (matching admin behavior)
    if (order.status === 'on-hold' && order.id) {
      console.log('🚀 Auto-generating budget PDF for on-hold order:', order.id);
      
      // Import the budget generation function
      const { generateBudgetPdfFromId } = await import('../../../lib/orderPdfGenerationService');
      
      // Generate budget PDF in the background (don't block order response)
      generateBudgetPdfFromId(
        order.id,
        true, // uploadToR2
        true  // sendEmail
      ).then(result => {
        if (result.success) {
          console.log('✅ Budget PDF generated and email sent for order:', order.id);
          console.log('📎 Budget URL:', result.pdfUrl);
        } else {
          console.error('❌ Budget generation failed for order:', order.id, result.error);
        }
      }).catch(err => {
        console.error('💥 Error in auto budget generation for order:', order.id, err);
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: order
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie'
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
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true'
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    },
  });
};
