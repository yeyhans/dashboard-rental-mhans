import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Get URL parameters
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const per_page = url.searchParams.get('per_page') || '10';
    const role = url.searchParams.get('role') || ''; // Permite filtrar por rol: subscriber, administrator, etc.

    // WordPress admin credentials
    const username = import.meta.env.WORDPRESS_USERNAME;
    const password = import.meta.env.WORDPRESS_PASSWORD;

    console.log(`Variables de entorno disponibles: ${Boolean(username)} / ${Boolean(password)}`);
    
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    console.log(`Intentando autenticar con usuario: ${username}`);

    // Build the WordPress API URL with parameters - USANDO ENDPOINT ESTÁNDAR
    const wpApiUrl = new URL('https://rental.mariohans.cl/wp-json/wp/v2/users');
    wpApiUrl.searchParams.set('page', page);
    wpApiUrl.searchParams.set('per_page', per_page);
    
    // Si se solicita un rol específico (como 'subscriber' o 'administrator')
    if (role) {
      wpApiUrl.searchParams.set('roles', role);
    }

    console.log(`Consultando usuarios con rol: ${role || 'todos'}`);
    console.log(`URL de consulta: ${wpApiUrl.toString()}`);

    // Fetch users from WordPress API with authentication
    const response = await fetch(wpApiUrl.toString(), {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });
    
    if (!response.ok) {
      console.error(`Error en la API de WordPress: ${response.status} ${response.statusText}`);
      
      try {
        // Intentar leer el mensaje de error de la API
        const errorData = await response.json();
        console.error('Detalles del error:', JSON.stringify(errorData));
        
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

    const users = await response.json();

    // Return all user data without filtering
    return new Response(JSON.stringify({
      users: users,
      total: response.headers.get('X-WP-Total'),
      totalPages: response.headers.get('X-WP-TotalPages')
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Error fetching WordPress users:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch users',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};
