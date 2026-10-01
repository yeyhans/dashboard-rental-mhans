import type { APIRoute } from 'astro';
import { withAuth } from '../../../middleware/auth';
import { ShippingService } from '../../../services/shippingService';

// Solo lo consume el dashboard autenticado; el middleware global resuelve CORS, no autenticación.
export const GET: APIRoute = withAuth(async () => {
  try {
    const stats = await ShippingService.getShippingStats();

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    // El detalle queda solo en el servidor: `error.message` viene de Postgres y puede filtrar
    // nombres de columnas, constraints o fragmentos de la consulta.
    console.error('[GET /api/shipping/stats] Error al obtener estadísticas de envío:', error);
    return new Response(JSON.stringify({
      error: 'Error al obtener estadísticas de envío'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});
