import type { APIRoute } from 'astro';
import { UserService } from '../../../services/userService';
import { OrderService } from '../../../services/orderService';
import { ProductService } from '../../../services/productService';
import { CouponService } from '../../../services/couponService';
import { supabaseAdmin } from '../../../lib/supabase';
// withCors removed - global middleware handles CORS

export const GET: APIRoute = async (context) => {
  // Check for admin session from HTTP-only cookie
  const sessionCookie = context.cookies.get('admin_session')?.value;
  
  if (!sessionCookie) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Sesión de administrador requerida'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let sessionData;
  try {
    sessionData = JSON.parse(decodeURIComponent(sessionCookie));
    
    // Check if session is still valid
    if (!sessionData.expires_at || Date.now() >= sessionData.expires_at) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Sesión expirada'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify admin user still exists
    const { data: admin, error } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('user_id', sessionData.user_id)
      .eq('role', 'admin')
      .single();
      
    if (error || !admin) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Acceso denegado. Permisos de administrador requeridos.'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Error validating session:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Sesión inválida'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Obtener estadísticas de todos los servicios en paralelo
    const [userStats, orderStats, productStats, couponStats] = await Promise.all([
      UserService.getUserStats(),
      OrderService.getOrderStats(),
      ProductService.getProductStats(),
      CouponService.getCouponStats()
    ]);

    // Calcular métricas adicionales
    const totalRevenue = parseFloat(orderStats.totalRevenue);
    const monthlyRevenue = orderStats.monthlyOrders * parseFloat(orderStats.averageOrderValue);
    
    // Calcular crecimiento mensual (simulado - en producción vendría de datos históricos)
    const previousMonthRevenue = monthlyRevenue * 0.85; // Simulación
    const revenueGrowth = previousMonthRevenue > 0 
      ? ((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue * 100).toFixed(1)
      : '0';

    const dashboardData = {
      overview: {
        totalUsers: userStats.totalUsers,
        totalOrders: orderStats.totalOrders,
        totalProducts: productStats.totalProducts,
        totalRevenue: orderStats.totalRevenue,
        monthlyRevenue: monthlyRevenue.toFixed(2),
        revenueGrowth: `${revenueGrowth}%`,
        averageOrderValue: orderStats.averageOrderValue,
        conversionRate: userStats.totalUsers > 0 
          ? ((orderStats.totalOrders / userStats.totalUsers) * 100).toFixed(1) + '%'
          : '0%'
      },
      orders: {
        total: orderStats.totalOrders,
        pending: orderStats.pendingOrders,
        processing: orderStats.processingOrders,
        completed: orderStats.completedOrders,
        cancelled: orderStats.cancelledOrders,
        monthly: orderStats.monthlyOrders,
        statusDistribution: orderStats.statusCounts
      },
      products: {
        total: productStats.totalProducts,
        published: productStats.activeProducts,
        draft: productStats.inactiveProducts,
        outOfStock: productStats.outOfStock,
        lowStock: 0, // Will be calculated from stock data
        featured: productStats.featuredProducts
      },
      users: {
        total: userStats.totalUsers,
        active: userStats.totalUsers, // Using total as active for now
        verified: userStats.usersWithContracts,
        withContracts: userStats.usersWithContracts,
        monthly: userStats.recentUsers
      },
      coupons: {
        total: couponStats.totalCoupons,
        active: couponStats.activeCoupons,
        used: couponStats.usedCoupons,
        expired: couponStats.expiredCoupons,
        totalDiscount: couponStats.totalDiscount,
        usageRate: couponStats.usageRate
      },
      recentActivity: {
        // En una implementación real, esto vendría de logs o eventos
        lastOrderDate: new Date().toISOString(),
        lastUserRegistration: new Date().toISOString(),
        lastProductUpdate: new Date().toISOString()
      }
    };

    return new Response(JSON.stringify({
      success: true,
      data: dashboardData
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in GET /api/dashboard:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error al obtener datos del dashboard'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};

// OPTIONS handler removed - handled by global middleware
