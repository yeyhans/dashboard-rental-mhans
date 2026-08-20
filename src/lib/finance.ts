/**
 * Finanzas & Cobranza — the pure derivations.
 *
 * Source: `Área 01 · Rental Técnico/OFF/MarioHans_OS_Area01_Finanzas_Cobranza_Canonical_RC2.1.4.html`.
 * RC2.1.2 and RC2.1.4 were compared and carry the same structure and the same figures; the later
 * revision is used, and the earlier one is not a competing source.
 *
 * The canonical asks one question — "¿Cuánto dinero ingresó y qué dinero falta cobrar?" — over
 * three tabs: Pendientes, Pagados and Finanzas.
 *
 * The money rules come from `.claude/rules/01-business-context.md`, which is the business
 * authority: 25% reserve on confirmation, 75% balance on return, and no pickup without payment.
 */

import { canonicalStatus } from './orderStatus';

/** Reserve share charged when the order is confirmed. */
export const RESERVE_RATE = 0.25;

export interface FinanceOrderLike {
  readonly status: string;
  readonly total: number;
  /** `orders.pago_reserva` — the 25% is in. */
  readonly reservePaid: boolean;
  /** `orders.pago_completo` — the whole amount is in. */
  readonly fullyPaid: boolean;
  /** `orders.order_fecha_termino`, the day the rental ends. */
  readonly endDate: string | null;
}

function isoDay(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The 25% due on confirmation. */
export function reserveAmount(total: number): number {
  return Math.round((Number.isFinite(total) ? total : 0) * RESERVE_RATE);
}

/**
 * What the customer still owes.
 *
 * Three states, not two: nothing paid (the whole total), reserve in (the 75% balance), fully paid
 * (zero). Treating "reserve paid" as "paid" would hide three quarters of the money owed.
 */
export function outstandingAmount(order: FinanceOrderLike): number {
  const total = Number.isFinite(order.total) ? order.total : 0;
  if (order.fullyPaid) return 0;
  if (order.reservePaid) return Math.max(0, total - reserveAmount(total));
  return Math.max(0, total);
}

/** Money actually collected so far. */
export function collectedAmount(order: FinanceOrderLike): number {
  const total = Number.isFinite(order.total) ? order.total : 0;
  if (order.fullyPaid) return total;
  if (order.reservePaid) return reserveAmount(total);
  return 0;
}

/**
 * A payment is overdue once the gear is back and the balance is still open.
 *
 * The business rule is "saldo (75%) se paga al devolver el equipo", so the balance falls due on
 * the return, not on some invoice date the schema does not carry. Cancelled orders are never
 * overdue — nothing was owed.
 */
export function isOverdue(order: FinanceOrderLike, now: Date): boolean {
  if (order.fullyPaid) return false;
  const stage = canonicalStatus(order.status);
  if (stage === 'cancelled') return false;
  if (!order.endDate) return false;
  return isoDay(order.endDate) < isoDay(now);
}

/** Still owes money and was not cancelled. */
export function isPending(order: FinanceOrderLike): boolean {
  return !order.fullyPaid && canonicalStatus(order.status) !== 'cancelled';
}

export interface PendingKpis {
  montoPendiente: number;
  documentosPendientes: number;
  pedidosPendientes: number;
  reservasPendientes: number;
  montoReservasPendientes: number;
  montoVencido: number;
  documentosVencidos: number;
}

/**
 * The Pendientes tab.
 *
 * `reservasPendientes` counts orders whose 25% has not come in yet — the ones that cannot be
 * picked up at all — and its amount is only that 25%, not the full total: quoting the total there
 * would double-count against Monto Pendiente and overstate what is collectable today.
 */
export function pendingKpis(orders: readonly FinanceOrderLike[], now: Date): PendingKpis {
  const kpis: PendingKpis = {
    montoPendiente: 0,
    documentosPendientes: 0,
    pedidosPendientes: 0,
    reservasPendientes: 0,
    montoReservasPendientes: 0,
    montoVencido: 0,
    documentosVencidos: 0,
  };

  for (const order of orders) {
    if (!isPending(order)) continue;

    const outstanding = outstandingAmount(order);
    kpis.montoPendiente += outstanding;
    kpis.documentosPendientes++;
    kpis.pedidosPendientes++;

    if (!order.reservePaid) {
      kpis.reservasPendientes++;
      kpis.montoReservasPendientes += reserveAmount(order.total);
    }

    if (isOverdue(order, now)) {
      kpis.montoVencido += outstanding;
      kpis.documentosVencidos++;
    }
  }

  return kpis;
}

export interface PaidKpis {
  cobradoPeriodo: number;
  pedidosPagados: number;
  ticketPromedio: number;
}

/** The Pagados tab. The average divides by paid orders, so an empty period gives 0, not NaN. */
export function paidKpis(orders: readonly FinanceOrderLike[]): PaidKpis {
  const paid = orders.filter(o => o.fullyPaid);
  const cobradoPeriodo = paid.reduce((sum, o) => sum + (Number.isFinite(o.total) ? o.total : 0), 0);

  return {
    cobradoPeriodo,
    pedidosPagados: paid.length,
    ticketPromedio: paid.length > 0 ? Math.round(cobradoPeriodo / paid.length) : 0,
  };
}

export interface FinanceSummary {
  ingresosPeriodo: number;
  cobrosRecibidos: number;
  porCobrar: number;
  tasaCobranza: number;
}

/**
 * The Finanzas tab.
 *
 * `ingresosPeriodo` is everything invoiced excluding cancellations; `cobrosRecibidos` is what
 * actually came in, reserves included. The gap between the two is the collection problem the
 * module exists to show — reporting only one of them hides it.
 */
export function financeSummary(orders: readonly FinanceOrderLike[]): FinanceSummary {
  let ingresosPeriodo = 0;
  let cobrosRecibidos = 0;

  for (const order of orders) {
    if (canonicalStatus(order.status) === 'cancelled') continue;
    ingresosPeriodo += Number.isFinite(order.total) ? order.total : 0;
    cobrosRecibidos += collectedAmount(order);
  }

  return {
    ingresosPeriodo,
    cobrosRecibidos,
    porCobrar: ingresosPeriodo - cobrosRecibidos,
    tasaCobranza: ingresosPeriodo > 0 ? Math.round((cobrosRecibidos / ingresosPeriodo) * 100) : 0,
  };
}

/** Percentage change against a previous period, or `null` when there is no base to compare. */
export function periodDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
