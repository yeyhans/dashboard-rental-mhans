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

  static async getBoard(now: Date = new Date(), limit = 500): Promise<FinanceBoard> {
    FinanceService.ensureSupabaseAdmin();

    const { data, error } = await supabaseAdmin!
      .from('orders')
      .select(
        'id, order_key, status, order_proyecto, order_fecha_termino, date_paid, date_completed, ' +
          'calculated_total, pago_reserva, pago_completo, reserve_type, reserve_value, ' +
          'orden_compra, numero_factura, ' +
          'billing_first_name, billing_last_name, billing_company'
      )
      .in('status', bookingStatusFilter())
      .order('order_fecha_termino', { ascending: true })
      .limit(limit);

    if (error) throw error;

    const rows: FinanceRow[] = (data ?? []).map((row: any) => {
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
