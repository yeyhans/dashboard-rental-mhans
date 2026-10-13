import { supabaseAdmin } from '../lib/supabase';
import { bookingStatusFilter, canonicalStatus } from '../lib/orderStatus';
import {
  collectedAmount,
  financeSummary,
  isOverdue,
  isPending,
  outstandingAmount,
  paidKpis,
  paymentDate,
  paymentUpdateColumns,
  pendingKpis,
  reserveAmount,
  type FinanceSummary,
  type PaidKpis,
  type PaymentDateSource,
  type PaymentUpdate,
  type PendingKpis,
} from '../lib/finance';
import { buildFinanceCharts, trailingMonths, type ChartOrder, type FinanceCharts } from '../lib/financeCharts';

/**
 * R-03b: rows fetched per request for the charts. PostgREST caps a response (1000 rows by
 * default), so the window is read in pages instead of trusting one `limit`.
 */
const CHART_PAGE_SIZE = 1000;
const CHART_MAX_PAGES = 20;

/**
 * D1-a: the board reads every non-cancelled order in pages. A single `limit` ordered by end date
 * ascending silently dropped the NEWEST orders once the table passed the cap.
 */
const BOARD_PAGE_SIZE = 1000;
const BOARD_MAX_PAGES = 50;

function clientName(row: any): string {
  const company = row.billing_company?.trim();
  const person = `${row.billing_first_name ?? ''} ${row.billing_last_name ?? ''}`.trim();
  return company || person || 'Sin cliente';
}

export interface FinanceRow {
  id: number;
  reference: string;
  client: string;
  project: string;
  status: string;
  total: number;
  reserve: number;
  outstanding: number;
  collected: number;
  reservePaid: boolean;
  fullyPaid: boolean;
  overdue: boolean;
  endDate: string | null;
  /** Best payment date available — see `paymentDate` in `lib/finance.ts`. */
  paidAt: string | null;
  paidAtSource: PaymentDateSource | null;
  purchaseOrder: string | null;
  invoiceNumber: string | null;
}

/** An order's payment state after `FinanceService.updatePayment`. */
export interface SavedPayment {
  id: number;
  fullyPaid: boolean;
  reservePaid: boolean;
  paidAt: string | null;
  purchaseOrder: string | null;
  invoiceNumber: string | null;
}

export interface FinanceBoard {
  pending: PendingKpis;
  paid: PaidKpis;
  summary: FinanceSummary;
  pendingRows: FinanceRow[];
  paidRows: FinanceRow[];
}

/**
 * Data for Finanzas & Cobranza.
 *
 * The board reads every non-cancelled order rather than a date window. Collections do not respect
 * month boundaries: an invoice unpaid since March is the row that most needs to be on screen, and
 * scoping the query to the current period is exactly how it would disappear.
 */
export class FinanceService {
  private static ensureSupabaseAdmin() {
    if (!supabaseAdmin) throw new Error('Supabase admin client is not initialized');
  }

  static async getBoard(now: Date = new Date()): Promise<FinanceBoard> {
    FinanceService.ensureSupabaseAdmin();

    const data: any[] = [];
    for (let page = 0; page < BOARD_MAX_PAGES; page++) {
      const from = page * BOARD_PAGE_SIZE;
      const { data: chunk, error } = await supabaseAdmin!
        .from('orders')
        .select(
          'id, order_key, status, order_proyecto, order_fecha_termino, date_paid, date_completed, ' +
            'calculated_total, pago_reserva, pago_completo, reserve_type, reserve_value, ' +
            'orden_compra, numero_factura, ' +
            'billing_first_name, billing_last_name, billing_company'
        )
        .in('status', bookingStatusFilter())
        .order('order_fecha_termino', { ascending: true })
        // Tie-breaker: without a unique key, rows sharing an end date can repeat or vanish
        // across pages.
        .order('id', { ascending: true })
        .range(from, from + BOARD_PAGE_SIZE - 1);

      if (error) throw error;
      data.push(...(chunk ?? []));
      if (!chunk || chunk.length < BOARD_PAGE_SIZE) break;
    }

    const rows: FinanceRow[] = data.map((row: any) => {
      const company = row.billing_company?.trim();
      const person = `${row.billing_first_name ?? ''} ${row.billing_last_name ?? ''}`.trim();
      const like = {
        status: row.status,
        total: Number(row.calculated_total) || 0,
        reservePaid: !!row.pago_reserva,
        fullyPaid: !!row.pago_completo,
        endDate: row.order_fecha_termino,
        reserveType: row.reserve_type,
        reserveValue: row.reserve_value,
      };
      const paid = paymentDate({ datePaid: row.date_paid, dateCompleted: row.date_completed });

      return {
        id: row.id,
        reference: row.order_key || `PED-${row.id}`,
        client: company || person || 'Sin cliente',
        project: row.order_proyecto || 'Sin proyecto',
        status: canonicalStatus(row.status) ?? row.status,
        total: like.total,
        reserve: reserveAmount(like),
        outstanding: outstandingAmount(like),
        collected: collectedAmount(like),
        reservePaid: like.reservePaid,
        fullyPaid: like.fullyPaid,
        overdue: isOverdue(like, now),
        endDate: row.order_fecha_termino,
        paidAt: paid.date,
        paidAtSource: paid.source,
        purchaseOrder: row.orden_compra,
        invoiceNumber: row.numero_factura,
      };
    });

    const likes = rows.map(r => ({
      status: r.status,
      total: r.total,
      reservePaid: r.reservePaid,
      fullyPaid: r.fullyPaid,
      endDate: r.endDate,
    }));

    return {
      pending: pendingKpis(likes, now),
      paid: paidKpis(likes),
      summary: financeSummary(likes),
      // Lo vencido primero: es la cola de trabajo real de cobranza.
      pendingRows: rows
        .filter((_, i) => isPending(likes[i]!))
        .sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.endDate ?? '').localeCompare(b.endDate ?? '')),
      paidRows: rows
        .filter(r => r.fullyPaid)
        .sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? '')),
    };
  }

  /**
   * R-03b: the Finanzas tab — 12-month series and indicators, aggregated here so the page
   * receives a few hundred numbers instead of every order. Like `getBoard` (D1-a), it pages
   * past the PostgREST row cap so the newest months are never the ones cut.
   */
  static async getCharts(now: Date = new Date(), months = 12): Promise<FinanceCharts> {
    FinanceService.ensureSupabaseAdmin();

    // One day before the first month, so the business-zone bucketing (Chile is behind UTC) can
    // trim the edge instead of losing the first hours of the window.
    const [year, month] = trailingMonths(now, months)[0]!.split('-').map(Number) as [number, number];
    const since = new Date(Date.UTC(year, month - 1, 1) - 86_400_000).toISOString().slice(0, 10);

    const rows: any[] = [];
    for (let page = 0; page < CHART_MAX_PAGES; page++) {
      const from = page * CHART_PAGE_SIZE;
      const { data, error } = await supabaseAdmin!
        .from('orders')
        .select(
          'id, status, date_created, calculated_total, pago_reserva, pago_completo, ' +
            'reserve_type, reserve_value, numero_factura, ' +
            'billing_first_name, billing_last_name, billing_company, user_profiles(tipo_cliente)'
        )
        .gte('date_created', since)
        .order('id', { ascending: true })
        .range(from, from + CHART_PAGE_SIZE - 1);

      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < CHART_PAGE_SIZE) break;
    }

    const orders: ChartOrder[] = rows.map((row: any) => {
      const profile = Array.isArray(row.user_profiles) ? row.user_profiles[0] : row.user_profiles;
      const tipo = profile?.tipo_cliente;
      return {
        status: row.status,
        total: Number(row.calculated_total) || 0,
        reservePaid: !!row.pago_reserva,
        fullyPaid: !!row.pago_completo,
        endDate: null,
        reserveType: row.reserve_type,
        reserveValue: row.reserve_value,
        createdAt: row.date_created,
        client: clientName(row),
        clientType: tipo === 'empresa' || tipo === 'natural' ? tipo : null,
        invoiceNumber: row.numero_factura ?? null,
      };
    });

    return buildFinanceCharts(orders, now, months);
  }

  /**
   * R-03a: the Pago select and the OC / Factura inputs of Finanzas & Cobranza.
   *
   * `update` is already validated (`validatePaymentUpdate`). Returns `null` when the order does
   * not exist.
   */
  static async updatePayment(id: number, update: PaymentUpdate, now: Date = new Date()): Promise<SavedPayment | null> {
    FinanceService.ensureSupabaseAdmin();

    const { data, error } = await supabaseAdmin!
      .from('orders')
      .update(paymentUpdateColumns(update, now))
      .eq('id', id)
      .select('id, pago_completo, pago_reserva, date_paid, orden_compra, numero_factura')
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const row = data as any;
    return {
      id: row.id,
      fullyPaid: !!row.pago_completo,
      reservePaid: !!row.pago_reserva,
      paidAt: row.date_paid ?? null,
      purchaseOrder: row.orden_compra ?? null,
      invoiceNumber: row.numero_factura ?? null,
    };
  }
}
