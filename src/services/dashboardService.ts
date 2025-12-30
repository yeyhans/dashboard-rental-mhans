import { supabaseAdmin } from '../lib/supabase';
import type { Database } from '../types/database';

type Order = Database['public']['Tables']['orders']['Row'];

export interface DashboardStats {
  monthlyOrderStats: {
    totalOrders: number;
    completedOrders: number;
    createdOrders: number;
    pendingOrders: number;
    processingOrders: number;
    onHoldOrders: number;
  };
  ordersByStatus: {
    onHold: Order[];
    pending: Order[];
    processing: Order[];
    completed: Order[];
  };
  rentedEquipment: Array<{
    productName: string;
    productImage: string;
    orderId: number;
    orderProject: string;
    endDate: string;
    status: string;
    daysRemaining: number;
  }>;
  financialSummary: {
    totalSales: number;
    totalPaid: number;
    totalPending: number;
    reservationPayments: number; // 25% payments
    finalPayments: number; // 75% payments
  };
}

export class DashboardService {
  /**
   * Obtener estadísticas completas del dashboard
   */
  static async getDashboardStats(): Promise<DashboardStats> {
    try {
      if (!supabaseAdmin) {
        throw new Error('Supabase admin client is not initialized');
      }

      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);
      
      const nextMonth = new Date(currentMonth);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      // Obtener estadísticas mensuales
      const monthlyStats = await this.getMonthlyOrderStats(currentMonth, nextMonth);
      
      // Obtener órdenes por estado
      const ordersByStatus = await this.getOrdersByStatus();
      
      // Obtener equipos rentados
      const rentedEquipment = await this.getRentedEquipment();
      
      // Obtener resumen financiero
      const financialSummary = await this.getFinancialSummary();

      return {
        monthlyOrderStats: monthlyStats,
        ordersByStatus,
        rentedEquipment,
        financialSummary
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de órdenes del mes
   */
  private static async getMonthlyOrderStats(startDate: Date, endDate: Date) {
    try {
      if (!supabaseAdmin) {
        throw new Error('Supabase admin client is not initialized');
      }

      const { data: monthlyOrders, error } = await supabaseAdmin
        .from('orders')
        .select('status, date_created, date_completed')
        .gte('date_created', startDate.toISOString())
        .lt('date_created', endDate.toISOString());

      if (error) throw error;

      const stats = {
        totalOrders: monthlyOrders?.length || 0,
        completedOrders: 0,
        createdOrders: monthlyOrders?.length || 0,
        pendingOrders: 0,
        processingOrders: 0,
        onHoldOrders: 0
      };

      monthlyOrders?.forEach(order => {
        switch (order.status) {
          case 'completed':
            stats.completedOrders++;
            break;
          case 'pending':
            stats.pendingOrders++;
            break;
          case 'processing':
            stats.processingOrders++;
            break;
          case 'on-hold':
            stats.onHoldOrders++;
            break;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error fetching monthly order stats:', error);
      throw error;
    }
  }

  /**
   * Obtener órdenes agrupadas por estado
   */
  private static async getOrdersByStatus() {
    try {
      if (!supabaseAdmin) {
        throw new Error('Supabase admin client is not initialized');
      }

      const { data: orders, error } = await supabaseAdmin
        .from('orders')
        .select(`
          *,
          user_profiles (
            nombre,
            apellido,
            email
          )
        `)
        .in('status', ['on-hold', 'pending', 'processing', 'completed'])
        .order('order_fecha_inicio', { ascending: false, nullsFirst: false })
        .limit(1000); // Aumentar límite significativamente para mostrar todas las órdenes

      if (error) throw error;

      const ordersByStatus = {
        onHold: [] as Order[],
        pending: [] as Order[],
        processing: [] as Order[],
        completed: [] as Order[]
      };

      orders?.forEach(order => {
        // Ensure calculated fields
        const orderWithCalculatedFields = {
          ...order,
          calculated_subtotal: order.calculated_subtotal || 0,
          calculated_discount: order.calculated_discount || 0,
          calculated_iva: order.calculated_iva || 0,
          calculated_total: order.calculated_total || order.total || 0,
          total: order.total || 0,
          shipping_total: order.shipping_total || 0
        };

        switch (order.status) {
          case 'on-hold':
            ordersByStatus.onHold.push(orderWithCalculatedFields);
            break;
          case 'pending':
            ordersByStatus.pending.push(orderWithCalculatedFields);
            break;
          case 'processing':
            ordersByStatus.processing.push(orderWithCalculatedFields);
            break;
          case 'completed':
            ordersByStatus.completed.push(orderWithCalculatedFields);
            break;
        }
      });

      return ordersByStatus;
    } catch (error) {
      console.error('Error fetching orders by status:', error);
      throw error;
    }
  }

  /**
   * Obtener equipos actualmente rentados
   */
  private static async getRentedEquipment() {
    try {
      if (!supabaseAdmin) {
        throw new Error('Supabase admin client is not initialized');
      }

      const currentDate = new Date();
      
      const { data: activeOrders, error } = await supabaseAdmin
        .from('orders')
        .select(`
          id,
          order_proyecto,
          order_fecha_inicio,
          order_fecha_termino,
          status,
          line_items
        `)
        .in('status', ['processing', 'completed', 'on-hold'])
        .not('order_fecha_termino', 'is', null)
        .gte('order_fecha_termino', currentDate.toISOString());

      if (error) throw error;

      const rentedEquipment: Array<{
        productName: string;
        productImage: string;
        orderId: number;
        orderProject: string;
        endDate: string;
        status: string;
        daysRemaining: number;
      }> = [];

      activeOrders?.forEach(order => {
        if (order.line_items) {
          let lineItems: any[] = [];
          
          try {
            if (typeof order.line_items === 'string') {
              lineItems = JSON.parse(order.line_items);
            } else if (Array.isArray(order.line_items)) {
              lineItems = order.line_items;
            }
          } catch (e) {
            console.warn('Error parsing line_items for order', order.id);
            return;
          }

          const endDate = new Date(order.order_fecha_termino!);
          const daysRemaining = Math.ceil((endDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

          lineItems.forEach(item => {
            rentedEquipment.push({
              productName: item.name || 'Producto sin nombre',
              productImage: item.image || 'https://via.placeholder.com/150',
              orderId: order.id,
              orderProject: order.order_proyecto || 'Sin proyecto',
              endDate: order.order_fecha_termino!,
              status: order.status,
              daysRemaining
            }); 
          });
        }
      });

      return rentedEquipment.sort((a, b) => a.daysRemaining - b.daysRemaining);
    } catch (error) {
      console.error('Error fetching rented equipment:', error);
      throw error;
    }
  }

  /**
   * Obtener resumen financiero
   */
  private static async getFinancialSummary() {
    try {
      if (!supabaseAdmin) {
        throw new Error('Supabase admin client is not initialized');
      }

      const { data: orders, error } = await supabaseAdmin
        .from('orders')
        .select(`
          status,
          calculated_total,
          pago_completo
        `)
        .in('status', ['completed', 'processing', 'on-hold', 'pending']);

      if (error) throw error;

      const summary = {
        totalSales: 0,
        totalPaid: 0,
        totalPending: 0,
        reservationPayments: 0, // 25% payments
        finalPayments: 0 // 75% payments
      };

      orders?.forEach(order => {
        const total = order.calculated_total || 0;
        summary.totalSales += total;

        if (order.status === 'completed') {
          if (order.pago_completo) {
            // Pago completo (25% + 75%)
            summary.totalPaid += total;
            summary.finalPayments += total * 0.75; // 75% del total
            summary.reservationPayments += total * 0.25; // 25% del total
          } else {
            // Solo reserva pagada (25%)
            const reservationAmount = total * 0.25;
            summary.totalPaid += reservationAmount;
            summary.reservationPayments += reservationAmount;
            summary.totalPending += total * 0.75; // 75% pendiente
          }
        } else {
          // Órdenes no completadas - todo pendiente
          summary.totalPending += total;
        }
      });

      return {
        totalSales: Math.round(summary.totalSales),
        totalPaid: Math.round(summary.totalPaid),
        totalPending: Math.round(summary.totalPending),
        reservationPayments: Math.round(summary.reservationPayments),
        finalPayments: Math.round(summary.finalPayments)
      };
    } catch (error) {
      console.error('Error fetching financial summary:', error);
      throw error;
    }
  }

  /**
   * Obtener órdenes filtradas por rango de fechas
   */
  static async getOrdersByDateRange(startDate: string, endDate: string, status?: string) {
    try {
      if (!supabaseAdmin) {
        throw new Error('Supabase admin client is not initialized');
      }

      // Log para debugging
      console.log('getOrdersByDateRange called with:', {
        startDate: `${startDate}T00:00:00.000Z`,
        endDate: `${endDate}T23:59:59.999Z`,
        status
      });

      let query = supabaseAdmin
        .from('orders')
        .select(`
          *,
          user_profiles (
            nombre,
            apellido,
            email
          )
        `)
        .gte('date_created', `${startDate}T00:00:00.000Z`)
        .lte('date_created', `${endDate}T23:59:59.999Z`)
        .order('date_created', { ascending: false })
        .limit(1000); // Agregar límite alto para asegurar que se obtengan todas las órdenes

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Log para debugging
      console.log(`getOrdersByDateRange found ${data?.length || 0} orders`);

      // Ensure calculated fields
      const ordersWithCalculatedFields = data?.map(order => ({
        ...order,
        calculated_subtotal: order.calculated_subtotal || 0,
        calculated_discount: order.calculated_discount || 0,
        calculated_iva: order.calculated_iva || 0,
        calculated_total: order.calculated_total || order.total || 0,
        total: order.total || 0,
        shipping_total: order.shipping_total || 0
      })) || [];

      return ordersWithCalculatedFields;
    } catch (error) {
      console.error('Error fetching orders by date range:', error);
      throw error;
    }
  }
}
