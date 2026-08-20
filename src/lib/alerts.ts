/**
 * Alertas — the Torre de Control's watchlist.
 *
 * The canonical carries a bell with a count badge in every module's sidebar but never expands the
 * panel, so the CONTENT is not specified there. It is derived instead from the operational rules
 * in `.claude/rules/01-business-context.md`, which are the business authority:
 *
 *   · "Sin pago NO hay retiro"      → a pickup due with no reserve paid
 *   · "Sin contrato NO hay retiro"  → a pickup due with no signed contract
 *   · "Devolución hasta las 13:00 del día siguiente" → a late return, which is billable
 *   · Balance falls due on return   → an overdue payment
 *
 * Every alert names something that BLOCKS an operation or costs money. A notice nobody must act
 * on trains people to ignore the bell, which is worse than no bell.
 */

import { canonicalStatus } from './orderStatus';
import { isOverdue, type FinanceOrderLike } from './finance';
import { isLateReturn } from './checkIn';

export type AlertSeverity = 'crit' | 'warn';

export type AlertKind =
  | 'pickup-without-payment'
  | 'pickup-without-contract'
  | 'late-return'
  | 'overdue-payment';

export interface Alert {
  kind: AlertKind;
  severity: AlertSeverity;
  orderId: number;
  reference: string;
  client: string;
  title: string;
  detail: string;
}

export interface AlertOrderLike extends FinanceOrderLike {
  readonly id: number;
  readonly reference: string;
  readonly client: string;
  /** `orders.order_fecha_inicio` — the rental's first day; pickup is the day before. */
  readonly startDate: string | null;
  /** Whether the customer profile carries `url_user_contrato`. */
  readonly hasContract: boolean;
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

/**
 * Whether the pickup window is open or imminent.
 *
 * Pickup is the day BEFORE the rental starts, 15:00–20:00. The alert fires from that day onward
 * while the rental has not begun — warning on the morning of the pickup is what gives the admin
 * time to chase a payment or a signature; warning on the start day is too late to fix anything.
 */
export function isPickupDue(startDate: string | null, now: Date): boolean {
  if (!startDate) return false;
  const today = isoDay(now);
  const start = isoDay(startDate);
  return today >= shiftDay(start, -1) && today <= start;
}

/**
 * Builds the watchlist, most severe first.
 *
 * A cancelled order raises nothing: there is no operation left to block.
 */
export function buildAlerts(orders: readonly AlertOrderLike[], now: Date): Alert[] {
  const alerts: Alert[] = [];

  for (const order of orders) {
    if (canonicalStatus(order.status) === 'cancelled') continue;

    const base = {
      orderId: order.id,
      reference: order.reference,
      client: order.client,
    };

    if (isPickupDue(order.startDate, now)) {
      if (!order.reservePaid && !order.fullyPaid) {
        alerts.push({
          ...base,
          kind: 'pickup-without-payment',
          severity: 'crit',
          title: 'Retiro sin la reserva pagada',
          detail: 'Sin pago no hay retiro. Confirma la transferencia antes de entregar el equipo.',
        });
      }
      if (!order.hasContract) {
        alerts.push({
          ...base,
          kind: 'pickup-without-contract',
          severity: 'crit',
          title: 'Retiro sin contrato firmado',
          detail: 'Sin contrato no hay retiro. El cliente debe completar y firmar antes del retiro.',
        });
      }
    }

    if (isLateReturn({ endDate: order.endDate, status: order.status, now })) {
      alerts.push({
        ...base,
        kind: 'late-return',
        severity: 'warn',
        title: 'Devolución atrasada',
        detail: 'Corresponde cobrar un día adicional por cada día de retraso.',
      });
    }

    if (isOverdue(order, now)) {
      alerts.push({
        ...base,
        kind: 'overdue-payment',
        severity: 'warn',
        title: 'Saldo vencido',
        detail: 'El equipo ya volvió y el saldo del 75% sigue pendiente.',
      });
    }
  }

  return alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'crit' ? -1 : 1));
}

/** The bell badge. */
export function alertCount(alerts: readonly Alert[]): number {
  return alerts.length;
}
