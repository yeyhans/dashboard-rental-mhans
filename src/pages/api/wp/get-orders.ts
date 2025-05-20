import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Get URL parameters
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const per_page = url.searchParams.get('per_page') || '100';
    const status = url.searchParams.get('status') || ''; // Filter by order status

    // WordPress admin credentials
    const username = import.meta.env.WORDPRESS_USERNAME;
    const password = import.meta.env.WORDPRESS_PASSWORD;
    const wpUrl = import.meta.env.WOOCOMMERCE_STORE_URL;

    if (!username || !password || !wpUrl) {
      throw new Error('WordPress credentials or URL are not configured');
    }

    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    // Build the WordPress API URL with parameters
    const wpApiUrl = new URL(`${wpUrl}/wp-json/custom/v1/orders`);
    wpApiUrl.searchParams.set('page', page);
    wpApiUrl.searchParams.set('per_page', per_page);
    
    if (status) {
      wpApiUrl.searchParams.set('status', status);
    }

    // Fetch orders from WordPress API with authentication
    console.log('=== Making Request ===');
    console.log('API URL:', wpApiUrl.toString());
    
    const response = await fetch(wpApiUrl.toString(), {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      try {
        const errorData = await response.json();
        console.error('Response body:', JSON.stringify(errorData, null, 2));
        
        if (response.status === 401) {
          return new Response(JSON.stringify({
            error: 'Error de autenticación',
            message: 'Credenciales inválidas para la API de WordPress',
            details: errorData
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({
          error: 'Error en API de WordPress',
          status: response.status,
          message: errorData.message || 'Error desconocido',
          details: errorData
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (jsonError) {
        // Si no podemos leer el JSON de error
        return new Response(JSON.stringify({
          error: `WordPress API responded with status: ${response.status}`,
          message: response.statusText
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const data = await response.json();
    
    // Debug log para verificar la estructura y contenido
    console.log('=== WordPress API Response ===');
    console.log('Response structure:', JSON.stringify(Object.keys(data), null, 2));
    
    // Verificar si hay órdenes y si tienen los campos requeridos
    if (data.orders && Array.isArray(data.orders)) {
      // Log de la primera orden para verificar campos
      if (data.orders.length > 0) {
        const firstOrder = data.orders[0];
        console.log('First order fields:', JSON.stringify(Object.keys(firstOrder), null, 2));
        console.log('orden_compra:', firstOrder.orden_compra);
        console.log('numero_factura:', firstOrder.numero_factura);
      }
      
      // Asegurar que cada orden tenga los campos requeridos
      const processedOrders = data.orders.map((order: any) => ({
        ...order,
        orden_compra: order.orden_compra || '',
        numero_factura: order.numero_factura || ''
      }));
      
      // Devolver los datos con las órdenes procesadas
      return new Response(JSON.stringify({
        success: true,
        data: {
          orders: processedOrders,
          total: data.total || response.headers.get('X-WP-Total'),
          totalPages: data.total_pages || response.headers.get('X-WP-TotalPages')
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Si la estructura es diferente a la esperada
    console.log('Unexpected data structure, returning raw data');
    
    return new Response(JSON.stringify({
      success: true,
      data: data
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Error fetching WordPress orders:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch orders',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};
