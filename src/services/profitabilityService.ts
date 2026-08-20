import { supabaseAdmin } from '../lib/supabase';
import { bookingStatusFilter } from '../lib/orderStatus';
import {
  assetRotation,
  growth,
  idleAssets,
  monthlyRevenueSeries,
  periodMetrics,
  type AssetRotation,
  type MonthlyRevenue,
  type PeriodMetrics,
  type RevenueOrderLike,
} from '../lib/profitability';
import type { LineItem } from '../types/order';

export interface ProfitabilityBoard {
  current: PeriodMetrics;
  previous: PeriodMetrics;
  deltas: {
    ingresos: number | null;
    jornadasVendidas: number | null;
    ticketPromedio: number | null;
    pedidosRealizados: number | null;
    equiposUtilizados: number | null;
  };
  series: MonthlyRevenue[];
  rotation: AssetRotation[];
  idle: Array<{ id: string; name: string }>;
  /** Calendar days in the period, which the canonical prints beside the metrics. */
  diasPeriodo: number;
}

function monthBounds(now: Date, offset = 0) {
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset, 1));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset + 1, 1));
  return { start, end, days: Math.round((end.getTime() - start.getTime()) / 86_400_000) };
}

/**
 * Data for Rentabilidad.
 *
 * Only the revenue half. Costs, operating expenses, margin, operating profit and asset ROI have
 * no table behind them — verified against `public`, which has twelve tables and records neither
 * an expense nor an acquisition cost. The view states that rather than showing a zero that reads
 * as "we spent nothing".
 */
export class ProfitabilityService {
  private static ensureSupabaseAdmin() {
    if (!supabaseAdmin) throw new Error('Supabase admin client is not initialized');
  }

  static async getBoard(now: Date = new Date()): Promise<ProfitabilityBoard> {
    ProfitabilityService.ensureSupabaseAdmin();

    // La serie necesita doce meses hacia atrás; se trae una sola vez y se reparte en memoria.
    const windowStart = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 11, 1));

    const [{ data: orderRows, error: ordersError }, { data: productRows, error: productsError }] =
      await Promise.all([
        supabaseAdmin!
          .from('orders')
          .select('status, calculated_total, num_jornadas, date_created, line_items')
          .in('status', bookingStatusFilter())
          .gte('date_created', windowStart.toISOString())
          .limit(2000),
        supabaseAdmin!.from('products').select('id, name').eq('status', 'publish').limit(1000),
      ]);

    if (ordersError) throw ordersError;
    if (productsError) throw productsError;

    const orders: RevenueOrderLike[] = (orderRows ?? []).map((row: any) => ({
      status: row.status,
      total: Number(row.calculated_total) || 0,
      jornadas: Number(row.num_jornadas) || 0,
      createdAt: row.date_created,
      lineItems: Array.isArray(row.line_items) ? (row.line_items as LineItem[]) : [],
    }));

    const thisMonth = monthBounds(now, 0);
    const lastMonth = monthBounds(now, -1);
    const inMonth = (o: RevenueOrderLike, bounds: { start: Date; end: Date }) =>
      !!o.createdAt &&
      o.createdAt >= bounds.start.toISOString().slice(0, 10) &&
      o.createdAt < bounds.end.toISOString().slice(0, 10);

    const currentOrders = orders.filter(o => inMonth(o, thisMonth));
    const previousOrders = orders.filter(o => inMonth(o, lastMonth));

    const current = periodMetrics(currentOrders);
    const previous = periodMetrics(previousOrders);
    const rotation = assetRotation(currentOrders);

    return {
      current,
      previous,
      deltas: {
        ingresos: growth(current.ingresos, previous.ingresos),
        jornadasVendidas: growth(current.jornadasVendidas, previous.jornadasVendidas),
        ticketPromedio: growth(current.ticketPromedio, previous.ticketPromedio),
        pedidosRealizados: growth(current.pedidosRealizados, previous.pedidosRealizados),
        equiposUtilizados: growth(current.equiposUtilizados, previous.equiposUtilizados),
      },
      series: monthlyRevenueSeries(orders, now),
      rotation,
      idle: idleAssets(productRows ?? [], rotation),
      diasPeriodo: thisMonth.days,
    };
  }
}
