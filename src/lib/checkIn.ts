/**
 * Check-In / Devoluciones — the pure derivations.
 *
 * Source: `Área 01 · Rental Técnico/OFF/MarioHans_OS_Area01_CheckIn_Devoluciones_Canonical_RC2.1.2.html`.
 * The canonical fixes the four KPIs (Pendientes Hoy, Recibidos Hoy, Incidencias, Devoluciones
 * Atrasadas), the per-order urgency of the return slot, and the five detail counters
 * (Total, Recibidos, Incompletos, Dañados/NE, Pendientes).
 *
 * Kept separate from the service so the arithmetic is testable without Supabase, and separate
 * from the component because this project has no jsdom.
 */

import type { LineItem } from '../types/order';
import { canonicalStatus } from './orderStatus';

/**
 * The return-slot urgency, which drives `.li-time` in the canonical (`soon` / `urgent` / `late`).
 *
 * Business rule, `.claude/rules/01-business-context.md`: "Devolución: hasta las 13:00 del día
 * siguiente al término del arriendo." Past that hour the return is late, and a late return is
 * billable — one extra day per day of delay. That is why `late` is a distinct state and not a
 * shade of `urgent`: it changes what the customer owes.
 */
export type ReturnUrgency = 'late' | 'urgent' | 'soon' | 'scheduled' | 'done';

/** The deadline is 13:00 of the day after the rental ends. */
export const RETURN_DEADLINE_HOUR = 13;

export interface ReturnSlotInput {
  /** `orders.order_fecha_termino`, a `date` column: `'2026-06-15'`. */
  readonly endDate: string | null;
  readonly status: string;
  /** Injected so the result is deterministic; a KPI on the process clock is untestable. */
  readonly now: Date;
}

/**
 * Splits an ISO-ish value into its calendar day. `order_fecha_termino` is a `date`, so parsing it
 * with `new Date()` would read midnight UTC and, at UTC-4, land on the previous day in Chile.
 */
function isoDay(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function returnUrgency({ endDate, status, now }: ReturnSlotInput): ReturnUrgency {
  if (canonicalStatus(status) === 'completed') return 'done';
  if (!endDate) return 'scheduled';

  const deadlineDay = addDays(isoDay(endDate), 1);
  const today = isoDay(now);

  if (today > deadlineDay) return 'late';
  if (today === deadlineDay) return now.getHours() >= RETURN_DEADLINE_HOUR ? 'late' : 'urgent';
  if (today === isoDay(endDate)) return 'soon';
  return 'scheduled';
}

/** Whether the return slot has already been missed — the billable case. */
export function isLateReturn(input: ReturnSlotInput): boolean {
  return returnUrgency(input) === 'late';
}

/** The four counters of the canonical `.kpi-strip`. */
export interface CheckInKpis {
  pendientesHoy: number;
  recibidosHoy: number;
  incidencias: number;
  atrasadas: number;
}

export interface CheckInOrderLike {
  readonly status: string;
  readonly endDate: string | null;
  /** Number of items flagged with damage or not returned. Zero until the schema records it. */
  readonly incidentCount?: number;
}

/**
 * Aggregates the KPI strip.
 *
 * `recibidosHoy` counts orders already closed today, `pendientesHoy` the ones whose slot is today
 * and are not closed, and `atrasadas` every open return past its deadline regardless of the day —
 * a return three days late must not fall off the board just because its slot was Monday.
 */
export function checkInKpis(orders: readonly CheckInOrderLike[], now: Date): CheckInKpis {
  const kpis: CheckInKpis = { pendientesHoy: 0, recibidosHoy: 0, incidencias: 0, atrasadas: 0 };
  const today = isoDay(now);

  for (const order of orders) {
    const urgency = returnUrgency({ endDate: order.endDate, status: order.status, now });
    kpis.incidencias += order.incidentCount ?? 0;

    if (urgency === 'done') {
      if (order.endDate && isoDay(order.endDate) === today) kpis.recibidosHoy++;
      continue;
    }
    if (urgency === 'late') kpis.atrasadas++;
    if (order.endDate && isoDay(order.endDate) === today) kpis.pendientesHoy++;
  }

  return kpis;
}

/** Reception state of a single unit. `pending` until someone checks it in. */
export type ItemReceiptState = 'pending' | 'received' | 'incomplete' | 'damaged';

export interface CheckInItem {
  readonly name: string;
  readonly sku: string;
  readonly quantity: number;
  readonly state: ItemReceiptState;
}

/** The five counters of the canonical detail panel. */
export interface CheckInTotals {
  total: number;
  recibidos: number;
  incompletos: number;
  danados: number;
  pendientes: number;
}

/**
 * Counts UNITS, not lines. A line of six C-stands that comes back with two missing is not "one
 * item pending" — the canonical's Total reads 12 for a twelve-unit order, so every counter has to
 * speak the same unit or the five numbers stop adding up to Total.
 */
export function checkInTotals(items: readonly CheckInItem[]): CheckInTotals {
  const totals: CheckInTotals = { total: 0, recibidos: 0, incompletos: 0, danados: 0, pendientes: 0 };

  for (const item of items) {
    const units = Math.max(0, item.quantity);
    totals.total += units;
    if (item.state === 'received') totals.recibidos += units;
    else if (item.state === 'incomplete') totals.incompletos += units;
    else if (item.state === 'damaged') totals.danados += units;
    else totals.pendientes += units;
  }

  return totals;
}

/**
 * Turns an order's `line_items` into the check-in list.
 *
 * Every unit starts `pending`: the schema has no per-item reception column, so there is nothing
 * to read back. See the note in `pages/check-in.astro` — showing a control that cannot persist
 * would repeat exactly the defect this change removed from `ProcessOrder`.
 */
export function itemsFromLineItems(lineItems: readonly LineItem[] | null | undefined): CheckInItem[] {
  if (!lineItems) return [];
  return lineItems.map(item => ({
    name: item.name,
    sku: item.sku,
    quantity: Number(item.quantity) || 0,
    state: 'pending' as const,
  }));
}
