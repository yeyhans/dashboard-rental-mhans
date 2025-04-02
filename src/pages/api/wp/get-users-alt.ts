import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Get URL parameters
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const per_page = url.searchParams.get('per_page') || '10';
    const role = url.searchParams.get('role') || '';

    // WordPress credentials
    const username = import.meta.env.WORDPRESS_USERNAME;
    const password = import.meta.env.WORDPRESS_PASSWORD;

    // Authenticate with JWT first (requires JWT Authentication for WP REST API plugin)
    console.log('Intentando obtener token JWT...');
    try {
      const authResponse = await fetch('https://rental.mariohans.cl/wp-json/jwt-auth/v1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!authResponse.ok) {
        const authError = await authResponse.json();
        console.error('Error en autenticación JWT:', JSON.stringify(authError));
        return new Response(JSON.stringify({
          error: 'Error de autenticación JWT',
          details: authError
        }), { status: 401 });
      }

      const authData = await authResponse.json();
      console.log('Token JWT obtenido correctamente');

      // Build WordPress API URL
      const wpApiUrl = new URL('https://rental.mariohans.cl/wp-json/wp/v2/users');
      wpApiUrl.searchParams.set('page', page);
      wpApiUrl.searchParams.set('per_page', per_page);
      if (role) {
        wpApiUrl.searchParams.set('roles', role);
      }

      console.log(`Consultando: ${wpApiUrl.toString()}`);
      
      // Fetch users with JWT token
      const response = await fetch(wpApiUrl.toString(), {
        headers: { 'Authorization': `Bearer ${authData.token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error en API de usuarios:', JSON.stringify(errorData));
        return new Response(JSON.stringify({
          error: 'Error en API de usuarios',
          status: response.status,
          details: errorData
        }), { status: response.status });
      }

      const users = await response.json();
      
      return new Response(JSON.stringify({
        users,
        total: response.headers.get('X-WP-Total'),
        totalPages: response.headers.get('X-WP-TotalPages')
      }), { status: 200 });
      
    } catch (error) {
      console.error('Error en proceso de JWT:', error);
      return new Response(JSON.stringify({
        error: 'Error en proceso JWT',
        message: error instanceof Error ? error.message : 'Error desconocido'
      }), { status: 500 });
    }

  } catch (error) {
    console.error('Error general:', error);
    return new Response(JSON.stringify({
      error: 'Error general',
      message: error instanceof Error ? error.message : 'Error desconocido'
    }), { status: 500 });
  }
}; 