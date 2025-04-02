import type { APIRoute } from 'astro';
import WooCommerce from './apiroute';

export const GET: APIRoute = async () => {
  try {
    // Test the connection by fetching products
    const response = await WooCommerce.get('products', {
      per_page: 1
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Conexión exitosa con WooCommerce',
      data: response.data
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error: any) {
    console.error('Error de conexión con WooCommerce:', error);
    
    // Log additional error details
    const errorDetails = {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        params: error.config?.params
      }
    };
    
    console.error('Detalles del error:', JSON.stringify(errorDetails, null, 2));

    return new Response(JSON.stringify({
      success: false,
      message: 'Error al conectar con WooCommerce',
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