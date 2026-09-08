/**
 * Agenda Operacional — the five-day board of the Centro de Control.
 *
 * Source: `Área 01 · Rental Técnico/OFF/MarioHans_OS_Area01_Centro_Control_Canonical_RC2.1.2.html`.
 * Each day carries three rows — Preparaciones, Entregas, Devoluciones — and the canonical prints
 * an explicit "Sin entregas programadas" when a row is empty rather than collapsing it.
 *
 * That detail is the point of the whole component: a missing row reads as "not loaded yet", while
 * an explicit "sin entregas" is a statement the admin can trust and plan around.
 *
 * The three rows come from the operational rules in `.claude/rules/01-business-context.md`:
 *
 *   · Preparación → the day BEFORE the rental starts, when gear is picked and checked
 *   · Entrega     → the rental's first day
 *   · Devolución  → the rental's last day
 */

import { canonicalStatus } from './orderStatus';

export type AgendaSlot = 'preparacion' | 'entrega' | 'devolucion';

export interface AgendaOrderLike {
  readonly id: number;
  readonly reference: string;
  readonly client: string;
  readonly project: string;
  readonly status: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
}

export interface AgendaEntry {
  orderId: number;
  reference: string;
  client: string;
  project: string;
}

export interface AgendaDay {
  /** `YYYY-MM-DD`. */
  date: string;
  preparaciones: AgendaEntry[];
  entregas: AgendaEntry[];
  devoluciones: AgendaEntry[];
}

function isoDay(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function toEntry(order: AgendaOrderLike): AgendaEntry {
  return {
    orderId: order.id,
    reference: order.reference,
    client: order.client,
    project: order.project,
  };
}

/**
 * Builds the next `days` calendar days starting today.
 *
 * Cancelled orders are excluded: nothing is prepared, delivered or returned for them, and leaving
 * them in would have the warehouse pick gear for a rental that is not happening.
 */
export function buildAgenda(
  orders: readonly AgendaOrderLike[],
  now: Date,
  days = 5
): AgendaDay[] {
  const today = isoDay(now);
  const board: AgendaDay[] = [];

  for (let i = 0; i < days; i++) {
    board.push({ date: shiftDay(today, i), preparaciones: [], entregas: [], devoluciones: [] });
  }

  const byDate = new Map(board.map(day => [day.date, day]));

  for (const order of orders) {
    if (canonicalStatus(order.status) === 'cancelled') continue;

    if (order.startDate) {
      const start = isoDay(order.startDate);
      byDate.get(shiftDay(start, -1))?.preparaciones.push(toEntry(order));
      byDate.get(start)?.entregas.push(toEntry(order));
    }
    if (order.endDate) {
      byDate.get(isoDay(order.endDate))?.devoluciones.push(toEntry(order));
    }
  }

  return board;
}

/** Total scheduled movements across the board — the "N operaciones" counter. */
export function agendaMovementCount(board: readonly AgendaDay[]): number {
  return board.reduce(
    (sum, day) => sum + day.preparaciones.length + day.entregas.length + day.devoluciones.length,
    0
  );
}
