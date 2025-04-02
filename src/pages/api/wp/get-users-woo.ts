import type { APIRoute } from 'astro';
import { createHmac } from 'crypto';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Get URL parameters
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const per_page = url.searchParams.get('per_page') || '10';
    const role = url.searchParams.get('role') || '';

    // WooCommerce API credentials
    const consumerKey = import.meta.env.WOOCOMMERCE_CONSUMER_KEY;
    const consumerSecret = import.meta.env.WOOCOMMERCE_CONSUMER_SECRET;

    // Check if credentials are available
    if (!consumerKey || !consumerSecret) {
      return new Response(JSON.stringify({
        error: 'Configuración incompleta',
        message: 'Faltan las claves de WooCommerce'
      }), { status: 500 });
    }

    console.log('Utilizando claves WooCommerce para autenticación');

    // Build WordPress API URL
    const wpApiUrl = new URL('https://rental.mariohans.cl/wp-json/wp/v2/users');
    wpApiUrl.searchParams.set('page', page);
    wpApiUrl.searchParams.set('per_page', per_page);
    if (role) {
      wpApiUrl.searchParams.set('roles', role);
    }
    
    // Add OAuth parameters
    wpApiUrl.searchParams.set('consumer_key', consumerKey);
    wpApiUrl.searchParams.set('consumer_secret', consumerSecret);

    console.log(`Consultando con OAuth: ${wpApiUrl.toString()}`);
    
    // Fetch users with WooCommerce OAuth
    const response = await fetch(wpApiUrl.toString());

    if (!response.ok) {
      try {
        const errorData = await response.json();
        console.error('Error en API de usuarios:', JSON.stringify(errorData));
        return new Response(JSON.stringify({
          error: 'Error en API de usuarios',
          status: response.status,
          details: errorData
        }), { status: response.status });
      } catch (e) {
        return new Response(JSON.stringify({
          error: 'Error en API de usuarios',
          status: response.status,
          statusText: response.statusText
        }), { status: response.status });
      }
    }

    const users = await response.json();
    
    return new Response(JSON.stringify({
      users,
      total: response.headers.get('X-WP-Total'),
      totalPages: response.headers.get('X-WP-TotalPages')
    }), { status: 200 });

  } catch (error) {
    console.error('Error general:', error);
    return new Response(JSON.stringify({
      error: 'Error general',
      message: error instanceof Error ? error.message : 'Error desconocido'
    }), { status: 500 });
  }
}; 