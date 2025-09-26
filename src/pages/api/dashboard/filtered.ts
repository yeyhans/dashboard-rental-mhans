import type { APIRoute } from 'astro';
import { DashboardService } from '../../../services/dashboardService';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { 
      dateRange, 
      status, 
      financialStatus, 
      searchTerm 
    } = body;

    console.log('Dashboard filter request:', {
      dateRange,
      status,
      financialStatus,
      searchTerm
    });

    // Validar parámetros - permitir búsqueda sin fechas
    if (!dateRange) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Date range object is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Si no hay fechas pero hay otros filtros, usar rango por defecto
    let actualDateRange = dateRange;
    if (!dateRange.start || !dateRange.end) {
      const end = new Date();
      const start = new Date();
      start.setMonth(end.getMonth() - 3); // Últimos 3 meses por defecto
      
      actualDateRange = {
        ...dateRange,
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      };
      
      console.log('Using default date range:', actualDateRange);
    }

    // Obtener datos filtrados
    const filteredOrders = await DashboardService.getOrdersByDateRange(
      actualDateRange.start,
      actualDateRange.end,
      status?.length > 0 ? status[0] : undefined // Por ahora solo el primer status
    );

    // Aplicar filtros adicionales en memoria
    let processedOrders = filteredOrders;

    // Filtro por término de búsqueda
    if (searchTerm && searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      processedOrders = processedOrders.filter(order => {
        // Buscar en campos del pedido
        const matchesOrder = order.order_proyecto?.toLowerCase().includes(searchLower) ||
                            order.billing_first_name?.toLowerCase().includes(searchLower) ||
                            order.billing_last_name?.toLowerCase().includes(searchLower) ||
                            order.billing_email?.toLowerCase().includes(searchLower) ||
                            order.id.toString().includes(searchLower);
        
        // Buscar en datos del perfil de usuario si están disponibles
        const matchesProfile = order.user_profiles?.nombre?.toLowerCase().includes(searchLower) ||
                              order.user_profiles?.apellido?.toLowerCase().includes(searchLower) ||
                              order.user_profiles?.email?.toLowerCase().includes(searchLower);
        
        return matchesOrder || matchesProfile;
      });
    }

    // Filtro por estado financiero
    if (financialStatus && financialStatus !== 'all') {
      processedOrders = processedOrders.filter(order => {
        switch (financialStatus) {
          case 'paid':
            return order.status === 'completed' && order.pago_completo;
          case 'partial':
            return order.status === 'completed' && !order.pago_completo;
          case 'pending':
            return order.status !== 'completed';
          default:
            return true;
        }
      });
    }

    // Calcular estadísticas de los datos filtrados
    const stats = {
      totalOrders: processedOrders.length,
      totalRevenue: processedOrders.reduce((sum, order) => sum + (order.calculated_total || 0), 0),
      statusBreakdown: processedOrders.reduce((acc: any, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {}),
      financialBreakdown: {
        totalSales: processedOrders.reduce((sum, order) => sum + (order.calculated_total || 0), 0),
        totalPaid: processedOrders
          .filter(order => order.status === 'completed')
          .reduce((sum, order) => {
            const total = order.calculated_total || 0;
            return sum + (order.pago_completo ? total : total * 0.25);
          }, 0),
        totalPending: processedOrders
          .reduce((sum, order) => {
            if (order.status !== 'completed') {
              return sum + (order.calculated_total || 0);
            } else if (!order.pago_completo) {
              return sum + (order.calculated_total || 0) * 0.75;
            }
            return sum;
          }, 0)
      }
    };

    return new Response(JSON.stringify({
      success: true,
      data: {
        orders: processedOrders.slice(0, 1000), // Aumentar límite para mostrar todas las órdenes
        stats,
        filters: {
          dateRange: actualDateRange,
          status,
          financialStatus,
          searchTerm,
          appliedAt: new Date().toISOString()
        }
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in dashboard filtered API:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({
    success: false,
    error: 'Method not allowed. Use POST to filter dashboard data.'
  }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  });
};
