import { supabaseAdmin } from '../lib/supabase';
import { bookingStatusFilter } from '../lib/orderStatus';
import {
  assetRotation,
  calculateMargin,
  calculateROI,
  growth,
  idleAssets,
  monthlyRevenueSeries,
  periodMetrics,
  sumByCategoryGroup,
  type AssetRotation,
  type MarginResult,
  type MonthlyRevenue,
  type PeriodMetrics,
  type RevenueOrderLike,
} from '../lib/profitability';
import { FIXED_EXPENSE_CATEGORIES, VARIABLE_EXPENSE_CATEGORIES } from '../types/expenses';
import type { LineItem } from '../types/order';

/** Postgres "undefined_table" — raised when `0006` has not been applied yet (see requirement 6). */
const UNDEFINED_TABLE = '42P01';

export interface ProfitabilityCosts {
  costosDirectos: number;
  margenBruto: MarginResult;
  gastosOperacionales: number;
  utilidadOperacional: MarginResult;
  /** `null` when no asset carries a recorded `acquisition_cost`, same convention as `calculateROI`. */
  roiPromedioActivos: number | null;
}

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
  /**
   * `null` while `0006_t026_schema_gaps.sql` is not applied to the connected database
   * (`expenses` / `serialised_assets.acquisition_cost` do not exist yet) — see requirement 6:
   * the board degrades gracefully instead of failing the whole page.
   */
  costs: ProfitabilityCosts | null;
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

  /**
   * Costos Directos / Gastos Operacionales / Margen Bruto / Utilidad Operacional / ROI — the
   * T-026 gap 3 half of the module. `null` if `expenses` or `acquisition_cost` are not present
   * yet (migration `0006` not applied), so `getBoard` can degrade gracefully instead of throwing.
   *
   * `client` is `supabaseAdmin as any` because `expenses` and `acquisition_cost` are not in the
   * generated `Database` type yet — same cast `expenseService.ts` uses.
   */
  private static async getCosts(
    client: any,
    ingresos: number,
    monthStart: Date,
    monthEnd: Date
  ): Promise<ProfitabilityCosts | null> {
    try {
      const [{ data: expenseRows, error: expensesError }, { data: assetRows, error: assetsError }] =
        await Promise.all([
          client
            .from('expenses')
            .select('category, amount, expense_date')
            .gte('expense_date', monthStart.toISOString().slice(0, 10))
            .lt('expense_date', monthEnd.toISOString().slice(0, 10)),
          client.from('serialised_assets').select('acquisition_cost'),
        ]);

      if (expensesError) throw expensesError;
      if (assetsError) throw assetsError;

      const expenses = (expenseRows ?? []) as Array<{ category: string; amount: number; expense_date: string }>;
      const costosDirectos = sumByCategoryGroup(expenses as any, VARIABLE_EXPENSE_CATEGORIES);
      const gastosOperacionales = sumByCategoryGroup(expenses as any, FIXED_EXPENSE_CATEGORIES);

      const margenBruto = calculateMargin(ingresos, costosDirectos);
      const utilidadOperacional = calculateMargin(margenBruto.margin, gastosOperacionales);

      const totalAcquisitionCost = ((assetRows ?? []) as Array<{ acquisition_cost: number | null }>).reduce(
        (sum, row) => sum + (Number(row.acquisition_cost) || 0),
        0
      );

      return {
        costosDirectos,
        margenBruto,
        gastosOperacionales,
        utilidadOperacional,
        roiPromedioActivos: calculateROI(utilidadOperacional.margin, totalAcquisitionCost),
      };
    } catch (error) {
      if ((error as { code?: string })?.code === UNDEFINED_TABLE) {
        console.warn(
          '[ProfitabilityService] Costos/gastos no disponibles todavía (migración 0006 sin aplicar):',
          { error }
        );
        return null;
      }
      throw error;
    }
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

    const costs = await ProfitabilityService.getCosts(
      supabaseAdmin as any,
      current.ingresos,
      thisMonth.start,
      thisMonth.end
    );

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
      costs,
    };
  }
}
