import { supabaseAdmin } from '../lib/supabase';
import type { Database } from '../types/database';

type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
type Order = Database['public']['Tables']['orders']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

// Interfaces para las estadísticas
export interface UserAnalytics {
  totalUsers: number;
  activeUsers: number;
  usersByType: {
    persona: number;
    empresa: number;
  };
  usersByRegion: Array<{
    ciudad: string;
    count: number;
  }>;
  usersWithContracts: number;
  conversionRate: number;
  newUsersThisMonth: number;
  userGrowthRate: number;
}

export interface ProductAnalytics {
  totalProducts: number;
  activeProducts: number;
  mostRentedProducts: Array<{
    id: number;
    name: string;
    sku: string;
    totalRentals: number;
    revenue: number;
    image?: string;
  }>;
  categoriesPerformance: Array<{
    category: string;
    productCount: number;
    totalRevenue: number;
    avgPrice: number;
  }>;
  stockStatus: {
    inStock: number;
    outOfStock: number;
    lowStock: number;
  };
  revenueByProduct: Array<{
    productId: number;
    name: string;
    revenue: number;
  }>;
}

export interface ProductRental {
  orderId: number;
  orderStatus: string;
  fechaInicio: string;
  fechaTermino: string;
  cliente: string;
  clienteEmail: string;
  precio: number;
  cantidad: number;
  fechaCreacion: string;
}

export interface CouponAnalytics {
  totalCouponsUsed: number;
  totalDiscountAmount: number;
  avgDiscountPerOrder: number;
  mostUsedCoupons: Array<{
    code: string;
    usageCount: number;
    totalDiscount: number;
  }>;
  discountImpact: {
    ordersWithDiscount: number;
    ordersWithoutDiscount: number;
    avgOrderValueWithDiscount: number;
    avgOrderValueWithoutDiscount: number;
  };
  discountTrends: Array<{
    month: string;
    totalDiscount: number;
    orderCount: number;
  }>;
}

export interface ShippingAnalytics {
  totalShippingRevenue: number;
  avgShippingCost: number;
  shippingMethods: Array<{
    method: string;
    count: number;
    totalRevenue: number;
    avgCost: number;
  }>;
  deliveryRegions: Array<{
    region: string;
    orderCount: number;
    totalShippingCost: number;
  }>;
  pickupVsShipping: {
    pickup: number;
    shipping: number;
  };
  shippingTrends: Array<{
    month: string;
    totalShipping: number;
    orderCount: number;
  }>;
}

export interface KPIAnalytics {
  customerLifetimeValue: number;
  averageOrderValue: number;
  customerRetentionRate: number;
  churnRate: number;
  conversionFunnel: {
    totalVisitors: number;
    registeredUsers: number;
    usersWithOrders: number;
    completedOrders: number;
  };
  monthlyRecurringRevenue: number;
  customerAcquisitionCost: number;
}

export interface OrderAnalytics {
  totalOrders: number;
  ordersByStatus: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  monthlyOrderTrends: Array<{
    month: string;
    totalOrders: number;
    completedOrders: number;
    revenue: number;
  }>;
  averageOrderProcessingTime: number;
  ordersByPaymentMethod: Array<{
    method: string;
    count: number;
    totalAmount: number;
  }>;
  topCustomers: Array<{
    customerId: number;
    customerName: string;
    orderCount: number;
    totalSpent: number;
  }>;
  orderValueDistribution: {
    ranges: Array<{
      range: string;
      count: number;
      percentage: number;
    }>;
    averageOrderValue: number;
    medianOrderValue: number;
  };
  projectAnalysis: Array<{
    projectName: string;
    orderCount: number;
    totalRevenue: number;
    avgDuration: number;
  }>;
  completionRate: number;
  cancelationRate: number;
}

export interface AdvancedAnalytics {
  users: UserAnalytics;
  products: ProductAnalytics;
  orders: OrderAnalytics;
  coupons: CouponAnalytics;
  shipping: ShippingAnalytics;
  kpis: KPIAnalytics;
  dateRange: {
    start: string;
    end: string;
  };
}

export class AdvancedAnalyticsService {
  /**
   * Obtener todas las estadísticas avanzadas
   */
  static async getAdvancedAnalytics(startDate?: string, endDate?: string): Promise<AdvancedAnalytics> {
    try {
      if (!supabaseAdmin) {
        throw new Error('Supabase admin client is not initialized');
      }

      // Definir rango de fechas por defecto (último mes)
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [users, products, orders, coupons, shipping, kpis] = await Promise.all([
        this.getUserAnalytics(start, end),
        this.getProductAnalytics(start, end),
        this.getOrderAnalytics(start, end),
        this.getCouponAnalytics(start, end),
        this.getShippingAnalytics(start, end),
        this.getKPIAnalytics(start, end)
      ]);

      return {
        users,
        products,
        orders,
        coupons,
        shipping,
        kpis,
        dateRange: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        }
      };
    } catch (error) {
      console.error('Error fetching advanced analytics:', error);
      throw error;
    }
  }

  /**
   * Análisis de usuarios
   */
  private static async getUserAnalytics(startDate: Date, endDate: Date): Promise<UserAnalytics> {
    try {
      // Total de usuarios
      const { data: allUsers, error: usersError } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, tipo_cliente, ciudad, terminos_aceptados, created_at');

      if (usersError) throw usersError;

      // Usuarios con órdenes (activos)
      const { data: usersWithOrders, error: activeError } = await supabaseAdmin
        .from('orders')
        .select('customer_id')
        .gte('date_created', startDate.toISOString())
        .lte('date_created', endDate.toISOString());

      if (activeError) throw activeError;

      const activeUserIds = new Set(usersWithOrders?.map(o => o.customer_id) || []);
      const totalUsers = allUsers?.length || 0;
      const activeUsers = activeUserIds.size;

      // Usuarios por tipo
      const usersByType = {
        persona: allUsers?.filter(u => u.tipo_cliente === 'persona').length || 0,
        empresa: allUsers?.filter(u => u.tipo_cliente === 'empresa').length || 0
      };

      // Usuarios por región
      const regionCounts = new Map<string, number>();
      allUsers?.forEach(user => {
        if (user.ciudad) {
          regionCounts.set(user.ciudad, (regionCounts.get(user.ciudad) || 0) + 1);
        }
      });

      const usersByRegion = Array.from(regionCounts.entries())
        .map(([ciudad, count]) => ({ ciudad, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Usuarios con contratos
      const usersWithContracts = allUsers?.filter(u => u.terminos_aceptados).length || 0;

      // Tasa de conversión (usuarios con órdenes / total usuarios)
      const conversionRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

      // Nuevos usuarios este mes
      const currentMonth = new Date();
      currentMonth.setDate(1);
      const newUsersThisMonth = allUsers?.filter(u => 
        new Date(u.created_at) >= currentMonth
      ).length || 0;

      // Crecimiento de usuarios (comparar con mes anterior)
      const lastMonth = new Date(currentMonth);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const newUsersLastMonth = allUsers?.filter(u => {
        const created = new Date(u.created_at);
        return created >= lastMonth && created < currentMonth;
      }).length || 0;

      const userGrowthRate = newUsersLastMonth > 0 
        ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100 
        : 0;

      return {
        totalUsers,
        activeUsers,
        usersByType,
        usersByRegion,
        usersWithContracts,
        conversionRate: Math.round(conversionRate * 100) / 100,
        newUsersThisMonth,
        userGrowthRate: Math.round(userGrowthRate * 100) / 100
      };
    } catch (error) {
      console.error('Error fetching user analytics:', error);
      throw error;
    }
  }

  /**
   * Análisis de productos
   */
  private static async getProductAnalytics(startDate: Date, endDate: Date): Promise<ProductAnalytics> {
    try {
      // Obtener todos los productos
      const { data: products, error: productsError } = await supabaseAdmin
        .from('products')
        .select('id, name, sku, price, stock_status, categories_name, images');

      if (productsError) throw productsError;

      // Obtener órdenes del período
      const { data: orders, error: ordersError } = await supabaseAdmin
        .from('orders')
        .select('line_items, calculated_total')
        .gte('date_created', startDate.toISOString())
        .lte('date_created', endDate.toISOString());

      if (ordersError) throw ordersError;

      const totalProducts = products?.length || 0;
      const activeProducts = products?.filter(p => p.stock_status === 'instock').length || 0;

      // Análisis de productos más rentados
      const productStats = new Map<number, { name: string; sku: string; totalRentals: number; revenue: number; image?: string }>();
      
      orders?.forEach(order => {
        if (order.line_items) {
          let lineItems: any[] = [];
          try {
            lineItems = typeof order.line_items === 'string' 
              ? JSON.parse(order.line_items) 
              : order.line_items;
          } catch (e) {
            return;
          }

          lineItems.forEach(item => {
            const productId = item.product_id || item.id;
            if (productId) {
              const existing = productStats.get(productId) || {
                name: item.name || 'Producto sin nombre',
                sku: item.sku || '',
                totalRentals: 0,
                revenue: 0,
                image: item.image
              };
              
              existing.totalRentals += item.quantity || 1;
              existing.revenue += (item.price || 0) * (item.quantity || 1);
              productStats.set(productId, existing);
            }
          });
        }
      });

      const mostRentedProducts = Array.from(productStats.entries())
        .map(([id, stats]) => ({ id, ...stats }))
        .sort((a, b) => b.totalRentals - a.totalRentals)
        .slice(0, 10);

      // Análisis por categorías
      const categoryStats = new Map<string, { productCount: number; totalRevenue: number; prices: number[] }>();
      
      products?.forEach(product => {
        const categories = product.categories_name || ['Sin categoría'];
        const categoryList = typeof categories === 'string' ? [categories] : categories;
        
        categoryList.forEach(category => {
          const existing = categoryStats.get(category) || { productCount: 0, totalRevenue: 0, prices: [] };
          existing.productCount += 1;
          existing.prices.push(product.price || 0);
          
          // Buscar revenue de este producto
          const productStat = productStats.get(product.id);
          if (productStat) {
            existing.totalRevenue += productStat.revenue;
          }
          
          categoryStats.set(category, existing);
        });
      });

      const categoriesPerformance = Array.from(categoryStats.entries())
        .map(([category, stats]) => ({
          category,
          productCount: stats.productCount,
          totalRevenue: stats.totalRevenue,
          avgPrice: stats.prices.length > 0 
            ? stats.prices.reduce((a, b) => a + b, 0) / stats.prices.length 
            : 0
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue);

      // Estado del stock
      const stockStatus = {
        inStock: products?.filter(p => p.stock_status === 'instock').length || 0,
        outOfStock: products?.filter(p => p.stock_status === 'outofstock').length || 0,
        lowStock: 0 // Esto requeriría un campo de cantidad en stock
      };

      // Revenue por producto
      const revenueByProduct = Array.from(productStats.entries())
        .map(([productId, stats]) => ({
          productId,
          name: stats.name,
          revenue: stats.revenue
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 20);

      return {
        totalProducts,
        activeProducts,
        mostRentedProducts,
        categoriesPerformance,
        stockStatus,
        revenueByProduct
      };
    } catch (error) {
      console.error('Error fetching product analytics:', error);
      throw error;
    }
  }

  /**
   * Análisis de cupones
   */
  private static async getCouponAnalytics(startDate: Date, endDate: Date): Promise<CouponAnalytics> {
    try {
      const { data: orders, error } = await supabaseAdmin
        .from('orders')
        .select('coupon_lines, calculated_discount, calculated_total, date_created')
        .gte('date_created', startDate.toISOString())
        .lte('date_created', endDate.toISOString());

      if (error) throw error;

      const ordersWithDiscount = orders?.filter(o => (o.calculated_discount || 0) > 0) || [];
      const ordersWithoutDiscount = orders?.filter(o => (o.calculated_discount || 0) === 0) || [];
      
      const totalCouponsUsed = ordersWithDiscount.length;
      const totalDiscountAmount = ordersWithDiscount.reduce((sum, o) => sum + (o.calculated_discount || 0), 0);
      const avgDiscountPerOrder = totalCouponsUsed > 0 ? totalDiscountAmount / totalCouponsUsed : 0;

      // Análisis de cupones más usados
      const couponStats = new Map<string, { usageCount: number; totalDiscount: number }>();
      
      ordersWithDiscount.forEach(order => {
        if (order.coupon_lines) {
          let coupons: any[] = [];
          try {
            coupons = typeof order.coupon_lines === 'string' 
              ? JSON.parse(order.coupon_lines) 
              : order.coupon_lines;
          } catch (e) {
            return;
          }

          coupons.forEach(coupon => {
            const code = coupon.code || 'Cupón sin código';
            const existing = couponStats.get(code) || { usageCount: 0, totalDiscount: 0 };
            existing.usageCount += 1;
            existing.totalDiscount += coupon.discount || order.calculated_discount || 0;
            couponStats.set(code, existing);
          });
        }
      });

      const mostUsedCoupons = Array.from(couponStats.entries())
        .map(([code, stats]) => ({ code, ...stats }))
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 10);

      // Impacto de descuentos
      const avgOrderValueWithDiscount = ordersWithDiscount.length > 0 
        ? ordersWithDiscount.reduce((sum, o) => sum + (o.calculated_total || 0), 0) / ordersWithDiscount.length
        : 0;
      
      const avgOrderValueWithoutDiscount = ordersWithoutDiscount.length > 0
        ? ordersWithoutDiscount.reduce((sum, o) => sum + (o.calculated_total || 0), 0) / ordersWithoutDiscount.length
        : 0;

      // Tendencias de descuentos por mes
      const monthlyDiscounts = new Map<string, { totalDiscount: number; orderCount: number }>();
      
      ordersWithDiscount.forEach(order => {
        const month = new Date(order.date_created).toISOString().slice(0, 7); // YYYY-MM
        const existing = monthlyDiscounts.get(month) || { totalDiscount: 0, orderCount: 0 };
        existing.totalDiscount += order.calculated_discount || 0;
        existing.orderCount += 1;
        monthlyDiscounts.set(month, existing);
      });

      const discountTrends = Array.from(monthlyDiscounts.entries())
        .map(([month, stats]) => ({ month, ...stats }))
        .sort((a, b) => a.month.localeCompare(b.month));

      return {
        totalCouponsUsed,
        totalDiscountAmount: Math.round(totalDiscountAmount),
        avgDiscountPerOrder: Math.round(avgDiscountPerOrder),
        mostUsedCoupons,
        discountImpact: {
          ordersWithDiscount: ordersWithDiscount.length,
          ordersWithoutDiscount: ordersWithoutDiscount.length,
          avgOrderValueWithDiscount: Math.round(avgOrderValueWithDiscount),
          avgOrderValueWithoutDiscount: Math.round(avgOrderValueWithoutDiscount)
        },
        discountTrends
      };
    } catch (error) {
      console.error('Error fetching coupon analytics:', error);
      throw error;
    }
  }

  /**
   * Análisis de shipping
   */
  private static async getShippingAnalytics(startDate: Date, endDate: Date): Promise<ShippingAnalytics> {
    try {
      const { data: orders, error } = await supabaseAdmin
        .from('orders')
        .select('shipping_lines, shipping_total, billing_city, date_created')
        .gte('date_created', startDate.toISOString())
        .lte('date_created', endDate.toISOString());

      if (error) throw error;

      const totalShippingRevenue = orders?.reduce((sum, o) => sum + (o.shipping_total || 0), 0) || 0;
      const ordersWithShipping = orders?.filter(o => (o.shipping_total || 0) > 0) || [];
      const avgShippingCost = ordersWithShipping.length > 0 
        ? totalShippingRevenue / ordersWithShipping.length 
        : 0;

      // Análisis de métodos de envío
      const shippingMethodStats = new Map<string, { count: number; totalRevenue: number }>();
      
      orders?.forEach(order => {
        if (order.shipping_lines) {
          let shippingLines: any[] = [];
          try {
            shippingLines = typeof order.shipping_lines === 'string' 
              ? JSON.parse(order.shipping_lines) 
              : order.shipping_lines;
          } catch (e) {
            return;
          }

          shippingLines.forEach(line => {
            const method = line.method_title || line.method_id || 'Método desconocido';
            const existing = shippingMethodStats.get(method) || { count: 0, totalRevenue: 0 };
            existing.count += 1;
            existing.totalRevenue += line.total || order.shipping_total || 0;
            shippingMethodStats.set(method, existing);
          });
        } else if ((order.shipping_total || 0) === 0) {
          // Probablemente pickup
          const existing = shippingMethodStats.get('Retiro en tienda') || { count: 0, totalRevenue: 0 };
          existing.count += 1;
          shippingMethodStats.set('Retiro en tienda', existing);
        }
      });

      const shippingMethods = Array.from(shippingMethodStats.entries())
        .map(([method, stats]) => ({
          method,
          count: stats.count,
          totalRevenue: stats.totalRevenue,
          avgCost: stats.count > 0 ? stats.totalRevenue / stats.count : 0
        }))
        .sort((a, b) => b.count - a.count);

      // Análisis por regiones
      const regionStats = new Map<string, { orderCount: number; totalShippingCost: number }>();
      
      orders?.forEach(order => {
        const region = order.billing_city || 'Región desconocida';
        const existing = regionStats.get(region) || { orderCount: 0, totalShippingCost: 0 };
        existing.orderCount += 1;
        existing.totalShippingCost += order.shipping_total || 0;
        regionStats.set(region, existing);
      });

      const deliveryRegions = Array.from(regionStats.entries())
        .map(([region, stats]) => ({ region, ...stats }))
        .sort((a, b) => b.orderCount - a.orderCount)
        .slice(0, 10);

      // Pickup vs Shipping
      const pickupOrders = orders?.filter(o => (o.shipping_total || 0) === 0).length || 0;
      const shippingOrders = orders?.filter(o => (o.shipping_total || 0) > 0).length || 0;

      // Tendencias de shipping por mes
      const monthlyShipping = new Map<string, { totalShipping: number; orderCount: number }>();
      
      orders?.forEach(order => {
        const month = new Date(order.date_created).toISOString().slice(0, 7);
        const existing = monthlyShipping.get(month) || { totalShipping: 0, orderCount: 0 };
        existing.totalShipping += order.shipping_total || 0;
        existing.orderCount += 1;
        monthlyShipping.set(month, existing);
      });

      const shippingTrends = Array.from(monthlyShipping.entries())
        .map(([month, stats]) => ({ month, ...stats }))
        .sort((a, b) => a.month.localeCompare(b.month));

      return {
        totalShippingRevenue: Math.round(totalShippingRevenue),
        avgShippingCost: Math.round(avgShippingCost),
        shippingMethods,
        deliveryRegions,
        pickupVsShipping: {
          pickup: pickupOrders,
          shipping: shippingOrders
        },
        shippingTrends
      };
    } catch (error) {
      console.error('Error fetching shipping analytics:', error);
      throw error;
    }
  }

  /**
   * Análisis de órdenes
   */
  private static async getOrderAnalytics(startDate: Date, endDate: Date): Promise<OrderAnalytics> {
    try {
      const { data: orders, error } = await supabaseAdmin
        .from('orders')
        .select('*')
        .gte('date_created', startDate.toISOString())
        .lte('date_created', endDate.toISOString());

      if (error) throw error;

      const totalOrders = orders?.length || 0;

      // Análisis por estado
      const statusCounts = new Map<string, number>();
      orders?.forEach(order => {
        const status = order.status || 'unknown';
        statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
      });

      const ordersByStatus = Array.from(statusCounts.entries())
        .map(([status, count]) => ({
          status,
          count,
          percentage: totalOrders > 0 ? (count / totalOrders) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count);

      // Tendencias mensuales
      const monthlyStats = new Map<string, { totalOrders: number; completedOrders: number; revenue: number }>();
      
      orders?.forEach(order => {
        const month = new Date(order.date_created).toISOString().slice(0, 7);
        const existing = monthlyStats.get(month) || { totalOrders: 0, completedOrders: 0, revenue: 0 };
        existing.totalOrders += 1;
        if (order.status === 'completed') {
          existing.completedOrders += 1;
          existing.revenue += order.calculated_total || 0;
        }
        monthlyStats.set(month, existing);
      });

      const monthlyOrderTrends = Array.from(monthlyStats.entries())
        .map(([month, stats]) => ({ month, ...stats }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // Tiempo promedio de procesamiento
      const completedOrders = orders?.filter(o => o.status === 'completed' && o.date_created && o.date_completed) || [];
      const processingTimes = completedOrders.map(order => {
        const created = new Date(order.date_created).getTime();
        const completed = new Date(order.date_completed).getTime();
        return (completed - created) / (1000 * 60 * 60 * 24); // días
      });
      
      const averageOrderProcessingTime = processingTimes.length > 0 
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length 
        : 0;

      // Análisis por método de pago
      const paymentMethodStats = new Map<string, { count: number; totalAmount: number }>();
      
      orders?.forEach(order => {
        const method = order.payment_method || 'No especificado';
        const existing = paymentMethodStats.get(method) || { count: 0, totalAmount: 0 };
        existing.count += 1;
        existing.totalAmount += order.calculated_total || 0;
        paymentMethodStats.set(method, existing);
      });

      const ordersByPaymentMethod = Array.from(paymentMethodStats.entries())
        .map(([method, stats]) => ({ method, ...stats }))
        .sort((a, b) => b.count - a.count);

      // Top clientes
      const customerStats = new Map<number, { orderCount: number; totalSpent: number; customerName: string }>();
      
      orders?.forEach(order => {
        if (order.customer_id) {
          const existing = customerStats.get(order.customer_id) || { 
            orderCount: 0, 
            totalSpent: 0, 
            customerName: `${order.billing_first_name || ''} ${order.billing_last_name || ''}`.trim() || 'Cliente sin nombre'
          };
          existing.orderCount += 1;
          existing.totalSpent += order.calculated_total || 0;
          customerStats.set(order.customer_id, existing);
        }
      });

      const topCustomers = Array.from(customerStats.entries())
        .map(([customerId, stats]) => ({ customerId, ...stats }))
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10);

      // Distribución de valor de órdenes
      const orderValues = orders?.map(o => o.calculated_total || 0).filter(v => v > 0) || [];
      orderValues.sort((a, b) => a - b);
      
      const ranges = [
        { range: '$0 - $50,000', min: 0, max: 50000 },
        { range: '$50,001 - $100,000', min: 50001, max: 100000 },
        { range: '$100,001 - $200,000', min: 100001, max: 200000 },
        { range: '$200,001 - $500,000', min: 200001, max: 500000 },
        { range: '$500,001+', min: 500001, max: Infinity }
      ];

      const orderValueDistribution = {
        ranges: ranges.map(range => {
          const count = orderValues.filter(v => v >= range.min && v <= range.max).length;
          return {
            range: range.range,
            count,
            percentage: orderValues.length > 0 ? (count / orderValues.length) * 100 : 0
          };
        }),
        averageOrderValue: orderValues.length > 0 ? orderValues.reduce((a, b) => a + b, 0) / orderValues.length : 0,
        medianOrderValue: orderValues.length > 0 ? orderValues[Math.floor(orderValues.length / 2)] : 0
      };

      // Análisis de proyectos
      const projectStats = new Map<string, { orderCount: number; totalRevenue: number; durations: number[] }>();
      
      orders?.forEach(order => {
        const projectName = order.order_proyecto || 'Sin proyecto';
        const existing = projectStats.get(projectName) || { orderCount: 0, totalRevenue: 0, durations: [] };
        existing.orderCount += 1;
        existing.totalRevenue += order.calculated_total || 0;
        
        // Calcular duración si hay fechas
        if (order.order_fecha_inicio && order.order_fecha_termino) {
          const start = new Date(order.order_fecha_inicio).getTime();
          const end = new Date(order.order_fecha_termino).getTime();
          const duration = (end - start) / (1000 * 60 * 60 * 24); // días
          if (duration > 0) {
            existing.durations.push(duration);
          }
        }
        
        projectStats.set(projectName, existing);
      });

      const projectAnalysis = Array.from(projectStats.entries())
        .map(([projectName, stats]) => ({
          projectName,
          orderCount: stats.orderCount,
          totalRevenue: stats.totalRevenue,
          avgDuration: stats.durations.length > 0 
            ? stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length 
            : 0
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10);

      // Tasas de completación y cancelación
      const completedCount = orders?.filter(o => o.status === 'completed').length || 0;
      const canceledCount = orders?.filter(o => o.status === 'cancelled' || o.status === 'failed').length || 0;
      
      const completionRate = totalOrders > 0 ? (completedCount / totalOrders) * 100 : 0;
      const cancelationRate = totalOrders > 0 ? (canceledCount / totalOrders) * 100 : 0;

      return {
        totalOrders,
        ordersByStatus,
        monthlyOrderTrends,
        averageOrderProcessingTime: Math.round(averageOrderProcessingTime * 10) / 10,
        ordersByPaymentMethod,
        topCustomers,
        orderValueDistribution: {
          ...orderValueDistribution,
          averageOrderValue: Math.round(orderValueDistribution.averageOrderValue),
          medianOrderValue: Math.round(orderValueDistribution.medianOrderValue)
        },
        projectAnalysis,
        completionRate: Math.round(completionRate * 10) / 10,
        cancelationRate: Math.round(cancelationRate * 10) / 10
      };
    } catch (error) {
      console.error('Error fetching order analytics:', error);
      throw error;
    }
  }

  /**
   * KPIs avanzados
   */
  private static async getKPIAnalytics(startDate: Date, endDate: Date): Promise<KPIAnalytics> {
    try {
      // Obtener datos necesarios
      const [ordersResult, usersResult] = await Promise.all([
        supabaseAdmin
          .from('orders')
          .select('customer_id, calculated_total, date_created, status')
          .gte('date_created', startDate.toISOString())
          .lte('date_created', endDate.toISOString()),
        supabaseAdmin
          .from('user_profiles')
          .select('user_id, created_at')
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (usersResult.error) throw usersResult.error;

      const orders = ordersResult.data || [];
      const users = usersResult.data || [];

      // Average Order Value
      const completedOrders = orders.filter(o => o.status === 'completed');
      const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.calculated_total || 0), 0);
      const averageOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

      // Customer Lifetime Value (simplificado)
      const customerOrderCounts = new Map<number, number>();
      const customerRevenue = new Map<number, number>();
      
      completedOrders.forEach(order => {
        const customerId = order.customer_id;
        customerOrderCounts.set(customerId, (customerOrderCounts.get(customerId) || 0) + 1);
        customerRevenue.set(customerId, (customerRevenue.get(customerId) || 0) + (order.calculated_total || 0));
      });

      const avgOrdersPerCustomer = customerOrderCounts.size > 0 
        ? Array.from(customerOrderCounts.values()).reduce((a, b) => a + b, 0) / customerOrderCounts.size 
        : 0;
      
      const customerLifetimeValue = averageOrderValue * avgOrdersPerCustomer;

      // Customer Retention Rate (usuarios que hicieron más de una orden)
      const repeatCustomers = Array.from(customerOrderCounts.values()).filter(count => count > 1).length;
      const customerRetentionRate = customerOrderCounts.size > 0 
        ? (repeatCustomers / customerOrderCounts.size) * 100 
        : 0;

      // Churn Rate (inverso de retention)
      const churnRate = 100 - customerRetentionRate;

      // Conversion Funnel
      const totalUsers = users.length;
      const usersWithOrders = new Set(orders.map(o => o.customer_id)).size;
      const completedOrdersCount = completedOrders.length;
      
      const conversionFunnel = {
        totalVisitors: totalUsers, // Simplificado, en realidad sería tráfico web
        registeredUsers: totalUsers,
        usersWithOrders,
        completedOrders: completedOrdersCount
      };

      // Monthly Recurring Revenue (MRR) - simplificado
      const monthlyRecurringRevenue = totalRevenue / Math.max(1, 
        Math.ceil((endDate.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000))
      );

      // Customer Acquisition Cost (simplificado)
      const newCustomersInPeriod = users.filter(u => {
        const created = new Date(u.created_at);
        return created >= startDate && created <= endDate;
      }).length;
      
      // Asumiendo un costo de marketing del 10% del revenue
      const estimatedMarketingCost = totalRevenue * 0.1;
      const customerAcquisitionCost = newCustomersInPeriod > 0 
        ? estimatedMarketingCost / newCustomersInPeriod 
        : 0;

      return {
        customerLifetimeValue: Math.round(customerLifetimeValue),
        averageOrderValue: Math.round(averageOrderValue),
        customerRetentionRate: Math.round(customerRetentionRate * 100) / 100,
        churnRate: Math.round(churnRate * 100) / 100,
        conversionFunnel,
        monthlyRecurringRevenue: Math.round(monthlyRecurringRevenue),
        customerAcquisitionCost: Math.round(customerAcquisitionCost)
      };
    } catch (error) {
      console.error('Error fetching KPI analytics:', error);
      throw error;
    }
  }

  /**
   * Obtener todas las rentas de un producto específico
   */
  static async getProductRentals(productId: number, startDate?: Date, endDate?: Date): Promise<ProductRental[]> {
    try {
      if (!supabaseAdmin) {
        throw new Error('Supabase admin client is not initialized');
      }

      // Construir query base
      let baseQuery = supabaseAdmin
        .from('orders')
        .select(`
          id,
          status,
          date_created,
          order_fecha_inicio,
          order_fecha_termino,
          billing_first_name,
          billing_last_name,
          billing_email,
          calculated_total,
          line_items
        `, { count: 'exact' })
        .order('date_created', { ascending: false });

      // Aplicar filtros de fecha si están disponibles
      if (startDate) {
        baseQuery = baseQuery.gte('date_created', startDate.toISOString());
      }
      if (endDate) {
        baseQuery = baseQuery.lte('date_created', endDate.toISOString());
      }

      // Obtener todas las órdenes usando paginación automática
      const allOrders: any[] = [];
      const pageSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const query = baseQuery.range(offset, offset + pageSize - 1);
        const { data: orders, error, count } = await query;

        if (error) throw error;

        if (orders && orders.length > 0) {
          allOrders.push(...orders);
          offset += pageSize;
          hasMore = orders.length === pageSize && (count === null || offset < count);
        } else {
          hasMore = false;
        }
      }

      const orders = allOrders;

      const rentals: ProductRental[] = [];

      // Procesar cada orden para encontrar el producto
      orders?.forEach(order => {
        if (!order.line_items) return;

        let lineItems: any[] = [];
        try {
          lineItems = typeof order.line_items === 'string' 
            ? JSON.parse(order.line_items) 
            : order.line_items;
        } catch (e) {
          return;
        }

        // Buscar el producto en los line_items
        lineItems.forEach(item => {
          const itemProductId = item.product_id || item.id;
          if (itemProductId === productId) {
            const cliente = `${order.billing_first_name || ''} ${order.billing_last_name || ''}`.trim() || 'Cliente sin nombre';
            
            rentals.push({
              orderId: order.id,
              orderStatus: order.status || 'unknown',
              fechaInicio: order.order_fecha_inicio || '',
              fechaTermino: order.order_fecha_termino || '',
              cliente,
              clienteEmail: order.billing_email || '',
              precio: (item.price || 0) * (item.quantity || 1),
              cantidad: item.quantity || 1,
              fechaCreacion: order.date_created || ''
            });
          }
        });
      });

      // Ordenar por fecha de creación descendente (más recientes primero)
      return rentals.sort((a, b) => {
        const dateA = new Date(a.fechaCreacion).getTime();
        const dateB = new Date(b.fechaCreacion).getTime();
        return dateB - dateA;
      });
    } catch (error) {
      console.error('Error fetching product rentals:', error);
      throw error;
    }
  }
}
