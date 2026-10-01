import { isoDay } from './bodega';
import { startOfBusinessDay as startOfSantiagoDay } from './businessDay';
import type { AssetMovementLike, MovementDirection } from '../types/assetMovements';

export type { AssetMovementLike };

/**
 * Movimientos — the admin's live view of what the garage is scanning (batch 3).
 *
 * Pure derivations over movement rows; the service fetches, the page polls, this decides.
 * "Out now" is the rule shared with `lib/assetMovements.ts` and `lib/bodega.ts`: an asset is out
 * when its latest movement by `checked_at` is a checkout. "Overdue" is the order's end date being
 * behind today's calendar day — the return slot itself (13:00 next day, `lib/checkIn.ts`) is
 * the billing rule; this feed flags what the garage should be chasing.
 */

export interface FeedMovementLike extends AssetMovementLike {
  readonly id: number;
  readonly order_id: number;
}

export interface FeedOrderLike {
  readonly id: number;
  readonly order_fecha_termino?: string | null;
}

export interface MovementsKpis {
  /** Assets whose latest movement is a checkout. */
  readonly unitsOutNow: number;
  /** Of those, on an order whose end date is already past. */
  readonly unitsOverdue: number;
  /** Movements (either direction) with `checked_at` on today's calendar day. */
  readonly movementsToday: number;
}

export const DIRECTION_LABELS: Record<MovementDirection, string> = {
  checkout: 'Salida',
  checkin: 'Entrada',
};

/** Ids of orders whose end date is strictly before `today` (`YYYY-MM-DD`). */
export function overdueOrderIds(orders: readonly FeedOrderLike[], today: string): Set<number> {
  const ids = new Set<number>();
  for (const order of orders) {
    if (order.order_fecha_termino && isoDay(order.order_fecha_termino) < today) ids.add(order.id);
  }
  return ids;
}

/** The open checkouts sitting on an overdue order. */
export function overdueOut<T extends FeedMovementLike>(
  open: readonly T[],
  orders: readonly FeedOrderLike[],
  today: string
): T[] {
  const overdue = overdueOrderIds(orders, today);
  return open.filter((movement) => overdue.has(movement.order_id));
}

/** Whether one row of the feed deserves the `Atrasada` badge: a checkout still open on an overdue order. */
export function isOverdueRow(
  movement: FeedMovementLike,
  openAssetIds: ReadonlySet<number>,
  overdueOrders: ReadonlySet<number>
): boolean {
  return movement.direction === 'checkout' && openAssetIds.has(movement.asset_id) && overdueOrders.has(movement.order_id);
}

/**
 * `open` is the `asset_current_state` view filtered to checkouts (0012) — already one row per
 * unit; `movementsToday` is counted by the database over today's calendar day.
 */
export function kpis(
  open: readonly FeedMovementLike[],
  orders: readonly FeedOrderLike[],
  now: Date,
  movementsToday: number
): MovementsKpis {
  return {
    unitsOutNow: open.length,
    unitsOverdue: overdueOut(open, orders, isoDay(now)).length,
    movementsToday,
  };
}

/**
 * Santiago midnight of `now`'s business day, as the ISO instant PostgREST compares `checked_at`
 * against (R3-104: the server is UTC; "hoy" is Chile's today).
 */
export function startOfBusinessDay(now: Date): string {
  return startOfSantiagoDay(now);
}

/**
 * Whether a response may be applied: only the most recently started request wins (R4-102). A
 * slow reply from an earlier poll must not overwrite a newer one.
 */
export function isLatestRequest(seq: number, latestSeq: number): boolean {
  return seq === latestSeq;
}

/** Whether any filter carries a value — a value check, not an identity check (R2-102). */
export function hasActiveFilters<T extends object>(filters: T): boolean {
  return Object.values(filters as Record<string, unknown>).some((value) => value !== '' && value != null);
}

export interface FeedFilters {
  readonly direction?: MovementDirection | null;
  readonly adminId?: number | null;
  /** ISO instants; inclusive lower bound, exclusive upper bound. */
  readonly since?: string | null;
  readonly until?: string | null;
}

/** Client-side filter over already-loaded rows; the same predicate the API applies server-side. */
export function filterFeed<T extends FeedMovementLike & { readonly checked_by_admin_id: number | null }>(
  movements: readonly T[],
  filters: FeedFilters
): T[] {
  return movements.filter((movement) => {
    if (filters.direction && movement.direction !== filters.direction) return false;
    if (filters.adminId != null && movement.checked_by_admin_id !== filters.adminId) return false;
    if (filters.since && movement.checked_at < filters.since) return false;
    if (filters.until && movement.checked_at >= filters.until) return false;
    return true;
  });
}

/** Parses `?since=` / `?until=`: a valid ISO instant or null; `undefined` means "given but invalid". */
export function parseInstant(value: string | null): string | null | undefined {
  if (value === null || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
