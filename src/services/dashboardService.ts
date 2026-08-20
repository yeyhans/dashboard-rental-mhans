import { supabaseAdmin } from '../lib/supabase';
import {
  ORDER_STATUSES,
  bookingStatusFilter,
  canonicalStatus,
  emptyStatusBuckets,
  isTerminalStatus,
  type OrderStatus,
} from '../lib/orderStatus';
import type { Database } from '../types/database';

type Order = Database['public']['Tables']['orders']['Row'];

/** Los cuatro contadores de la `.kpi-row` del canónico de Pedidos. */
export interface OperationalKpis {
  retirosHoy: number;
  entregasHoy: number;
  devolucionesHoy: number;
  pedidosActivos: number;
}

/**
 * Día calendario en `YYYY-MM-DD`.
 *
 * Las columnas `order_fecha_inicio`/`order_fecha_termino` son `date`, no `timestamptz`, así que
 * llegan como `'2026-06-12'`. Pasarlas por `new Date()` las interpretaría como medianoche UTC y
 * en Chile (UTC-4) restaría un día — el mismo error que `formatDate` ya evita usando métodos UTC.
 * Por eso se recorta la cadena en vez de parsearla.
 */
function toIsoDay(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface MonthlyOrderStats {
  totalOrders: number;
  createdOrders: number;
  /**
   * Conteo por estado v1.2. Reemplaza a los cuatro contadores fijos
   * (`completedOrders`/`pendingOrders`/`processingOrders`/`onHoldOrders`), que nombraban estados
   * que despues de 0003 dejan de existir y dejaban sin contar a las cuatro etapas operacionales
   * mas cargadas del canonico.
   */
  byStatus: Record<OrderStatus, number>;
}

export interface DashboardStats {
  monthlyOrderStats: MonthlyOrderStats;
  /** Contadores de la `.kpi-row` del canónico de Pedidos. */
  operationalKpis: OperationalKpis;
  /** Un bucket por estado v1.2; siempre estan las ocho claves, aunque vengan vacias. */
  ordersByStatus: Record<OrderStatus, Order[]>;
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

      // Contadores operacionales del dia (fila de KPIs del canonico)
      const operationalKpis = await this.getOperationalKpis();

      return {
        monthlyOrderStats: monthlyStats,
        operationalKpis,
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

      const stats: MonthlyOrderStats = {
        totalOrders: monthlyOrders?.length || 0,
        createdOrders: monthlyOrders?.length || 0,
        byStatus: Object.fromEntries(ORDER_STATUSES.map(s => [s, 0])) as Record<OrderStatus, number>,
      };

      monthlyOrders?.forEach(order => {
        const bucket = canonicalStatus(order.status);
        if (bucket) stats.byStatus[bucket]++;
      });

      return stats;
    } catch (error) {
      console.error('Error fetching monthly order stats:', error);
      throw error;
    }
  }

  /**
   * Fila de KPIs de la pantalla canónica de Pedidos (`.kpi-row`).
   *
   * El canónico fija los cuatro rótulos y la pestaña a la que enlaza cada tarjeta, pero sus
   * valores son mock estático y no trae cómputo. La semántica sale de las reglas operacionales
   * de `.claude/rules/01-business-context.md`, que son la autoridad de negocio:
   *
   *   · "Retiro: día anterior al inicio del arriendo, 15:00–20:00"
   *   · "Devolución: hasta las 13:00 del día siguiente al término"
   *
   * De ahí, y de la pestaña destino de cada tarjeta:
   *
   *   Retiros Hoy      → en `preparation` y con inicio MAÑANA  → pestaña preparacion
   *   Entregas Hoy     → inicio HOY                            → pestaña arriendo
   *   Devoluciones Hoy → término HOY                           → pestaña devolucion
   *   Pedidos Activos  → todo lo no terminal                   → pestaña todos
   *
   * `today` se inyecta para que el cálculo sea determinista: un KPI atado al reloj del proceso
   * produce un test que falla a medianoche y pasa el resto del día.
   */
  static async getOperationalKpis(today: Date = new Date()): Promise<OperationalKpis> {
    const kpis: OperationalKpis = {
      retirosHoy: 0,
      entregasHoy: 0,
      devolucionesHoy: 0,
      pedidosActivos: 0,
    };

    try {
      if (!supabaseAdmin) {
        throw new Error('Supabase admin client is not initialized');
      }

      const { data: orders, error } = await supabaseAdmin
        .from('orders')
        .select('id, status, order_fecha_inicio, order_fecha_termino')
        .in('status', bookingStatusFilter());

      if (error) throw error;

      const hoy = toIsoDay(today);
      const manana = toIsoDay(new Date(today.getTime() + 24 * 60 * 60 * 1000));

      orders?.forEach(order => {
        const status = canonicalStatus(order.status);
        if (!status || isTerminalStatus(status)) return;

        kpis.pedidosActivos++;

        const inicio = order.order_fecha_inicio ? toIsoDay(order.order_fecha_inicio) : null;
        const termino = order.order_fecha_termino ? toIsoDay(order.order_fecha_termino) : null;

        if (status === 'preparation' && inicio === manana) kpis.retirosHoy++;
        if (inicio === hoy) kpis.entregasHoy++;
        if (termino === hoy) kpis.devolucionesHoy++;
      });

      return kpis;
    } catch (error) {
      console.error('[DashboardService] Error calculando los KPIs operacionales:', error);
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
          ),
          line_items
        `)
        .in('status', bookingStatusFilter())
        .order('order_fecha_inicio', { ascending: false, nullsFirst: false })
        .limit(1000); // Aumentar límite significativamente para mostrar todas las órdenes

      if (error) throw error;

      // Un bucket por estado del vocabulario v1.2. Antes eran cuatro casos fijos
      // (`on-hold | pending | processing | completed`) sin `default`: despues de 0003 las cuatro
      // etapas operacionales mas cargadas del canonico — evaluacion, preparacion, arriendo y
      // devolucion — caian por el hueco del switch y desaparecian del tablero. Sin error, sin
      // estado vacio, sin linea de log: el pedido no aparece y el equipo esta fuera de bodega.
      const ordersByStatus = emptyStatusBuckets<Order>();

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

        // Durante la ventana conviven ambos vocabularios; `canonicalStatus` pliega el valor
        // legado sobre su equivalente v1.2 en lugar de descartar la fila.
        const bucket = canonicalStatus(order.status);
        if (bucket) {
          ordersByStatus[bucket].push(orderWithCalculatedFields);
        } else {
          console.warn('[DashboardService] Pedido con estado no reconocido, sin agrupar:', {
            orderId: order.id,
            status: order.status,
          });
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
        .in('status', bookingStatusFilter())
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
          pago_reserva,
          pago_completo
        `)
        .in('status', bookingStatusFilter());

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
            summary.finalPayments += total * 0.75;
            summary.reservationPayments += total * 0.25;
          } else if (order.pago_reserva) {
            // Solo reserva pagada (25%)
            const reservationAmount = total * 0.25;
            summary.totalPaid += reservationAmount;
            summary.reservationPayments += reservationAmount;
            summary.totalPending += total * 0.75;
          } else {
            // Nada pagado — todo pendiente
            summary.totalPending += total;
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
