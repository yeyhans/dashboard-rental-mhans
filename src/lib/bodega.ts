import { businessDay } from './businessDay';
import { isAwaitingDispatch } from './delivery';
import type { ScanLine } from './bodegaScan';
import type { AssetMovementLike } from '../types/assetMovements';
import type { LineItem } from '../types/order';

/**
 * Bodega — the garage worker's board, as pure derivations.
 *
 * Two lists, both keyed on "what has to move through the door today":
 *
 *   - RETIROS: shipments still awaiting dispatch (`shipping_usage.status` pending/processing)
 *     whose order starts today or tomorrow. Equipment is picked up the day before the rental
 *     starts (15:00–20:00), so "tomorrow" is today's work.
 *   - DEVOLUCIONES: orders with at least one unit still out (an open checkout) whose end date is
 *     today or earlier. Past the end date the return is `Atrasada`.
 *
 * Days are compared as `YYYY-MM-DD` strings in Chile's calendar (`lib/businessDay.ts`, R3-104),
 * never as `Date` instants: `order_fecha_inicio` / `order_fecha_termino` are `date` columns, and
 * parsing `'2026-09-08'` with `new Date()` reads midnight UTC, which at UTC-4 is still the 7th in
 * Chile. `now`, an instant, is projected onto the Santiago day — the server (Vercel) runs UTC,
 * where the date rolls over at 20:00–21:00 Chile time.
 *
 * `now` is injected everywhere so the board is deterministic under test.
 */

export interface BodegaOrderLike {
  readonly id: number;
  readonly order_key?: string | null;
  readonly order_proyecto?: string | null;
  readonly order_fecha_inicio?: string | null;
  readonly order_fecha_termino?: string | null;
  readonly billing_first_name?: string | null;
  readonly billing_last_name?: string | null;
  readonly billing_company?: string | null;
  readonly line_items?: readonly LineItem[] | null;
}

export interface BodegaShipmentLike {
  readonly status: string;
  readonly order: BodegaOrderLike | null;
}

/** One movement with its order, the minimum needed to know which order a unit is out on. */
export interface BodegaMovementLike extends AssetMovementLike {
  readonly order_id: number;
}

export interface BodegaCard {
  readonly orderId: number;
  readonly reference: string;
  readonly client: string;
  readonly project: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
  /** Units that have gone through the door in this direction. */
  readonly scannedUnits: number;
  /** Units the order lists (`line_items` quantities summed). */
  readonly totalUnits: number;
  /** Devoluciones only: the end date is already behind us. */
  readonly overdue: boolean;
}

export interface BodegaBoard {
  readonly pickups: BodegaCard[];
  readonly returns: BodegaCard[];
}

/** Calendar day, `YYYY-MM-DD`: strings (date columns) are sliced, instants are read in Santiago. */
export function isoDay(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return businessDay(value);
}

export function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/** Today or tomorrow, inclusive on both ends. */
export function isPickupDue(startDate: string | null | undefined, today: string): boolean {
  if (!startDate) return false;
  const start = isoDay(startDate);
  return start === today || start === addDays(today, 1);
}

/** The end date is today or already behind us. */
export function isReturnDue(endDate: string | null | undefined, today: string): boolean {
  if (!endDate) return false;
  return isoDay(endDate) <= today;
}

export function isReturnOverdue(endDate: string | null | undefined, today: string): boolean {
  if (!endDate) return false;
  return isoDay(endDate) < today;
}

export function unitsInOrder(lineItems: readonly LineItem[] | null | undefined): number {
  if (!Array.isArray(lineItems)) return 0;
  return lineItems.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
}

export function clientName(
  order: Pick<BodegaOrderLike, 'billing_company' | 'billing_first_name' | 'billing_last_name'>
): string {
  const company = order.billing_company?.trim();
  const person = `${order.billing_first_name ?? ''} ${order.billing_last_name ?? ''}`.trim();
  return company || person || 'Sin cliente';
}

export function orderReference(order: BodegaOrderLike): string {
  return order.order_key || `PED-${order.id}`;
}

/** The one place the "no project" fallback lives (R2-101). */
export function projectLabel(order: Pick<BodegaOrderLike, 'order_proyecto'>): string {
  return order.order_proyecto?.trim() || 'Sin proyecto';
}

/**
 * Units currently out, grouped by the order they left on. "Currently out" is the same rule
 * `lib/assetMovements.ts` uses: the asset's latest movement by `checked_at` is a checkout.
 */
export function openCheckoutsByOrder(movements: readonly BodegaMovementLike[]): Map<number, Set<number>> {
  const latest = new Map<number, BodegaMovementLike>();
  for (const movement of movements) {
    const current = latest.get(movement.asset_id);
    if (!current || movement.checked_at > current.checked_at) latest.set(movement.asset_id, movement);
  }

  const byOrder = new Map<number, Set<number>>();
  for (const movement of latest.values()) {
    if (movement.direction !== 'checkout') continue;
    const set = byOrder.get(movement.order_id) ?? new Set<number>();
    set.add(movement.asset_id);
    byOrder.set(movement.order_id, set);
  }
  return byOrder;
}

function card(order: BodegaOrderLike, scannedUnits: number, overdue: boolean): BodegaCard {
  return {
    orderId: order.id,
    reference: orderReference(order),
    client: clientName(order),
    project: projectLabel(order),
    startDate: order.order_fecha_inicio ? isoDay(order.order_fecha_inicio) : null,
    endDate: order.order_fecha_termino ? isoDay(order.order_fecha_termino) : null,
    scannedUnits,
    totalUnits: unitsInOrder(order.line_items),
    overdue,
  };
}

/**
 * Retiros: one card per order (a second shipment row for the same order does not make a second
 * pickup), soonest start first. Progress = units already out on that order.
 */
export function pickupCards(
  shipments: readonly BodegaShipmentLike[],
  openByOrder: ReadonlyMap<number, ReadonlySet<number>>,
  today: string
): BodegaCard[] {
  const seen = new Set<number>();
  const cards: BodegaCard[] = [];
  for (const shipment of shipments) {
    const order = shipment.order;
    if (!order || seen.has(order.id)) continue;
    if (!isAwaitingDispatch(shipment.status)) continue;
    if (!isPickupDue(order.order_fecha_inicio, today)) continue;
    seen.add(order.id);
    cards.push(card(order, openByOrder.get(order.id)?.size ?? 0, false));
  }
  return cards.sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? '') || a.orderId - b.orderId);
}

/**
 * Devoluciones: orders with something still out and an end date that has arrived. Overdue first,
 * then by end date. Progress = units back = listed units minus units still out (never negative:
 * a unit lent beyond the line items would otherwise show as a negative return).
 */
export function returnCards(
  orders: readonly BodegaOrderLike[],
  openByOrder: ReadonlyMap<number, ReadonlySet<number>>,
  today: string
): BodegaCard[] {
  const cards: BodegaCard[] = [];
  for (const order of orders) {
    const open = openByOrder.get(order.id)?.size ?? 0;
    if (open === 0) continue;
    if (!isReturnDue(order.order_fecha_termino, today)) continue;
    const total = unitsInOrder(order.line_items);
    cards.push(card(order, Math.max(0, total - open), isReturnOverdue(order.order_fecha_termino, today)));
  }
  return cards.sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      (a.endDate ?? '').localeCompare(b.endDate ?? '') ||
      a.orderId - b.orderId
  );
}

export function buildBodegaBoard(input: {
  shipments: readonly BodegaShipmentLike[];
  orders: readonly BodegaOrderLike[];
  movements: readonly BodegaMovementLike[];
  now: Date;
}): BodegaBoard {
  const today = isoDay(input.now);
  const openByOrder = openCheckoutsByOrder(input.movements);
  return {
    pickups: pickupCards(input.shipments, openByOrder, today),
    returns: returnCards(input.orders, openByOrder, today),
  };
}

/**
 * The scan sheet's lines for one order: each `line_items` entry with how many of its units are
 * currently out on THIS order and how many came back. Movements are this order's only; an asset's
 * state is its latest movement here. Assets whose product is unknown (deleted unit) or not on the
 * order (lent as a substitute) are counted nowhere — the sheet shows the order as written.
 */
export function scanSheetLines(
  lineItems: readonly LineItem[] | null | undefined,
  movements: readonly BodegaMovementLike[],
  assetProducts: ReadonlyMap<number, number>
): ScanLine[] {
  const latest = new Map<number, BodegaMovementLike>();
  for (const movement of movements) {
    const current = latest.get(movement.asset_id);
    if (!current || movement.checked_at > current.checked_at) latest.set(movement.asset_id, movement);
  }

  const open = new Map<number, number>();
  const returned = new Map<number, number>();
  for (const movement of latest.values()) {
    const productId = assetProducts.get(movement.asset_id);
    if (productId === undefined) continue;
    const bucket = movement.direction === 'checkout' ? open : returned;
    bucket.set(productId, (bucket.get(productId) ?? 0) + 1);
  }

  const lines = new Map<number, ScanLine>();
  for (const item of Array.isArray(lineItems) ? lineItems : []) {
    const productId = Number(item.product_id);
    if (!Number.isInteger(productId) || productId <= 0) continue;
    const quantity = Math.max(0, Number(item.quantity) || 0);
    const existing = lines.get(productId);
    lines.set(productId, {
      productId,
      name: existing?.name || item.name?.trim() || `Producto ${productId}`,
      quantity: (existing?.quantity ?? 0) + quantity,
      open: open.get(productId) ?? 0,
      returned: returned.get(productId) ?? 0,
    });
  }
  return [...lines.values()];
}

/** `DD/MM/YYYY` for a `YYYY-MM-DD` day, without going through `Date`. */
export function formatDay(day: string | null): string {
  if (!day) return '—';
  const [y, m, d] = day.split('-');
  return y && m && d ? `${d}/${m}/${y}` : day;
}
