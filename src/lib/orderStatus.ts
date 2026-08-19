/**
 * Canonical `orders.status` vocabulary — Portal Cliente v1.2 (ADR-001).
 *
 * Single source of truth for the dashboard. Before this module the eight (previously seven)
 * values were spelled out by hand in 29 files under `src/`, each with its own list and its own
 * Spanish labels. That duplication is what makes a status migration dangerous: it turns one
 * rename into 29 independent chances to miss one, and the ones that get missed are the rarely
 * opened screens, where a wrong status is noticed last.
 *
 * Mirrors `supabase/migrations/0003_m4_status_portal_v12.sql`. The database CHECK constraint is
 * the real authority — if the two ever disagree, this file is the one that is wrong.
 */

/** The eight values the migrated `orders_status_check` constraint admits. */
export const ORDER_STATUSES = [
  'request',
  'evaluation',
  'confirmed',
  'preparation',
  'in-rental',
  'return',
  'completed',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Every value the PRE-migration constraint permitted.
 *
 * Kept after the migration on purpose: order archives, exported reports and the rollback snapshot
 * still carry these, and `migrateLegacyStatus` needs a definition of "legacy" to answer against.
 * `pending` and `refunded` hold zero rows in production but were constraint-permitted, so they
 * are covered here for the same reason the SQL `CASE` covers them.
 *
 * Note this is NOT the workflow documented in `.claude/rules/01-business-context.md`, which lists
 * `reviewing`, `preparing`, `delivering` and `paid`. Those four were never database values.
 */
export const LEGACY_ORDER_STATUSES = [
  'pending',
  'processing',
  'on-hold',
  'completed',
  'cancelled',
  'refunded',
  'failed',
] as const;

export type LegacyOrderStatus = (typeof LEGACY_ORDER_STATUSES)[number];

/** Spanish labels for the admin UI. Project convention: UI copy in Spanish, identifiers in English. */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  request: 'Solicitud',
  evaluation: 'En evaluación',
  confirmed: 'Confirmada',
  preparation: 'En preparación',
  'in-rental': 'En arriendo',
  return: 'En devolución',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

/**
 * The forward mapping, identical to the `CASE` in `0003_m4_status_portal_v12.sql`.
 *
 * Three source values collapse into `cancelled`, which is why there is no inverse here: the
 * rollback reads the `(id, status)` snapshot instead. Anything that needs to tell a migrated
 * `failed` from a migrated `cancelled` must read `orders.cancellation_reason`.
 */
const LEGACY_TO_V12: Record<LegacyOrderStatus, OrderStatus> = {
  completed: 'completed',
  cancelled: 'cancelled',
  failed: 'cancelled',
  'on-hold': 'request',
  processing: 'confirmed',
  pending: 'request',
  refunded: 'cancelled',
};

/** Narrows an untrusted value to `OrderStatus`. Accepts non-strings without throwing. */
export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value);
}

/** Narrows an untrusted value to `LegacyOrderStatus`. `completed` and `cancelled` are both. */
export function isLegacyOrderStatus(value: unknown): value is LegacyOrderStatus {
  return typeof value === 'string' && (LEGACY_ORDER_STATUSES as readonly string[]).includes(value);
}

/**
 * Maps a pre-migration value to its v1.2 equivalent.
 *
 * Returns `null` — not the input — for anything that is not a legacy status. A passthrough would
 * let an unknown value travel onward looking as though it had been migrated, which is the failure
 * this whole module exists to prevent.
 */
export function migrateLegacyStatus(value: unknown): OrderStatus | null {
  return isLegacyOrderStatus(value) ? LEGACY_TO_V12[value] : null;
}

/**
 * Spanish label for display. Falls back to the raw value rather than throwing or rendering
 * `undefined`: if the database somehow holds an unexpected status, an admin reading the raw
 * string is far more useful than a blank cell or a crashed React island.
 */
export function statusLabel(status: string): string {
  return isOrderStatus(status) ? STATUS_LABELS[status] : status;
}
