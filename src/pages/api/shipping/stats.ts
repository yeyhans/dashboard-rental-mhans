import type { APIRoute } from 'astro';
import { ShippingService } from '../../../services/shippingService';

export const GET: APIRoute = async () => {
  try {
    const stats = await ShippingService.getShippingStats();

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching shipping stats:', error);
    return new Response(JSON.stringify({ 
      error: 'Error al obtener estadísticas de envío',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
