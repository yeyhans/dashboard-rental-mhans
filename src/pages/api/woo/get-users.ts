import type { APIRoute } from 'astro';
import WooCommerce from './apiroute';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Get URL parameters
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const per_page = url.searchParams.get('per_page') || '10';
    const role = url.searchParams.get('role') || '';
    const search = url.searchParams.get('search') || '';
    const email = url.searchParams.get('email') || '';

    // Build query parameters
    const params: any = {
      page,
      per_page
    };

    // Add role filter if provided
    if (role) {
      params.role = role;
    }

    // Add search filter if provided
    if (search) {
      params.search = search;
    }

    // Add email filter if provided
    if (email) {
      params.email = email;
    }

    // Fetch users from WooCommerce
    const response = await WooCommerce.get('customers', params);

    // Process the response to include only relevant user data
    const processedUsers = response.data.map((user: any) => ({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      username: user.username,
      dateCreated: user.date_created,
      dateModified: user.date_modified,
      billing: {
        firstName: user.billing.first_name,
        lastName: user.billing.last_name,
        address1: user.billing.address_1,
        city: user.billing.city,
        state: user.billing.state,
        postcode: user.billing.postcode,
        country: user.billing.country,
        email: user.billing.email,
        phone: user.billing.phone
      },
      shipping: {
        firstName: user.shipping.first_name,
        lastName: user.shipping.last_name,
        address1: user.shipping.address_1,
        city: user.shipping.city,
        state: user.shipping.state,
        postcode: user.shipping.postcode,
        country: user.shipping.country,
        phone: user.shipping.phone
      },
      ordersCount: user.orders_count,
      totalSpent: user.total_spent
    }));

    return new Response(JSON.stringify({
      success: true,
      message: 'Usuarios obtenidos exitosamente',
      data: {
        users: processedUsers,
        total: response.headers['x-wp-total'],
        totalPages: response.headers['x-wp-totalpages']
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error: any) {
    console.error('Error al obtener usuarios:', error);
    
    const errorDetails = {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    };
    
    console.error('Detalles del error:', JSON.stringify(errorDetails, null, 2));

    return new Response(JSON.stringify({
      success: false,
      message: 'Error al obtener los usuarios',
      error: error.message,
      details: errorDetails
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
} 