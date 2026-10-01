import {
  canonicalStatus,
  isTerminalStatus,
  statusesForTab,
  statusTone,
  ORDER_LIST_TABS,
  type OrderListTab,
} from "../../lib/orderStatus";
import { businessDay } from "../../lib/businessDay";
import type { BadgeTone } from "../shared/statusBadgeTones";

/** The subset of order fields the D-05 Pedidos list KPIs and tabs need. */
export interface OrderListRow {
  status: unknown;
  order_fecha_inicio?: string | null;
  order_fecha_termino?: string | null;
}

/** The 4-KPI strip of the D-05 canon (same semantics as `DashboardService.getOperationalKpis`). */
export interface OrderListKpis {
  retirosHoy: number;
  entregasHoy: number;
  devolucionesHoy: number;
  pedidosActivos: number;
}

/**
 * Day calendar string in `YYYY-MM-DD`.
 *
 * Duplicated from `DashboardService`'s private `toIsoDay` rather than imported: that module is
 * server-only (it imports `supabaseAdmin` at the top level), and `OrdersDashboard` is a
 * `client:load` island — importing it here would pull the service-role client into the browser
 * bundle. The rationale for the string-slice (not `new Date()`) is the same: `order_fecha_inicio`/
 * `order_fecha_termino` are `date` columns, and parsing `'2026-06-12'` with `new Date()` reads it
 * as UTC midnight, which is the previous day in Chile (UTC-4).
 *
 * A `Date` instant (only `today` goes through this branch) is resolved with `businessDay`
 * (D-14e), not with `Date`'s local getters: those read the *runtime's* timezone (UTC on Vercel),
 * which rolls over the day hours before Santiago does.
 */
function toIsoDay(value: string | Date): string {
  if (typeof value === "string") return value.slice(0, 10);
  return businessDay(value);
}

/**
 * The D-05 Pedidos list's 4-KPI strip, computed client-side over the orders already loaded by
 * `OrdersDashboard` (no extra fetch). Same rules as `DashboardService.getOperationalKpis`:
 *
 *   Retiros Hoy      → `preparation` con inicio MAÑANA
 *   Entregas Hoy     → inicio HOY
 *   Devoluciones Hoy → término HOY
 *   Pedidos Activos  → todo lo no terminal
 *
 * `today` is injected so the computation is deterministic in tests.
 */
export function computeOrderListKpis(
  orders: readonly OrderListRow[],
  today: Date = new Date(),
): OrderListKpis {
  const kpis: OrderListKpis = {
    retirosHoy: 0,
    entregasHoy: 0,
    devolucionesHoy: 0,
    pedidosActivos: 0,
  };

  const hoy = toIsoDay(today);
  const manana = toIsoDay(new Date(today.getTime() + 24 * 60 * 60 * 1000));

  for (const order of orders) {
    const status = canonicalStatus(order.status);
    if (!status || isTerminalStatus(status)) continue;

    kpis.pedidosActivos++;

    const inicio = order.order_fecha_inicio
      ? toIsoDay(order.order_fecha_inicio)
      : null;
    const termino = order.order_fecha_termino
      ? toIsoDay(order.order_fecha_termino)
      : null;

    if (status === "preparation" && inicio === manana) kpis.retirosHoy++;
    if (inicio === hoy) kpis.entregasHoy++;
    if (termino === hoy) kpis.devolucionesHoy++;
  }

  return kpis;
}

/**
 * Resolves the `?status=` URL param to a valid `ORDER_LIST_TAB` (D-14a). Before this, an
 * unrecognised or legacy value (e.g. a bookmarked link from before the v1.2 migration) was set
 * as the tab verbatim, and `matchesOrderListTab` — correctly — matches nothing against a tab id
 * it does not recognise, so the list silently rendered empty instead of falling back to "todos".
 *
 * Maps legacy statuses (`processing`, `on-hold`, …) to their v1.2 tab via `canonicalStatus`, and
 * falls back to "todos" for anything without a tab — including `cancelled`/`failed`, which have
 * no tab in the canon (Q-6, out of scope here).
 */
export function resolveOrderListTabParam(
  value: string | null | undefined,
): OrderListTab {
  if (!value || value === "todos") return "todos";
  const canonical = canonicalStatus(value);
  if (canonical && ORDER_LIST_TABS.some((tab) => tab.value === canonical)) {
    return canonical as OrderListTab;
  }
  return "todos";
}

/** Whether `status` belongs to the given Pedidos list tab (`todos` excludes `cancelled`). */
export function matchesOrderListTab(status: unknown, tab: string): boolean {
  const canonical = canonicalStatus(status);
  if (!canonical) return false;
  return statusesForTab(tab).includes(canonical);
}

/** The orders belonging to one Pedidos list tab. */
export function filterOrdersByTab<T extends OrderListRow>(
  orders: readonly T[],
  tab: string,
): T[] {
  return orders.filter((order) => matchesOrderListTab(order.status, tab));
}

/**
 * Adapts `orderStatus.ts`'s six-tone `StatusTone` to the shared `StatusBadge`'s five-tone
 * `BadgeTone`. The only value the two disagree on is `muted` (`orderStatus.ts` uses it for
 * `cancelled`, one shade greyer than `neutral`), which `StatusBadge` does not model — it folds
 * back to `neutral` rather than mis-rendering or throwing.
 */
export function toBadgeTone(status: string): BadgeTone {
  const tone = statusTone(status);
  return tone === "muted" ? "neutral" : tone;
}

/** Per-tab counters for the tab strip, in the same order as `ORDER_LIST_TABS`. */
export function orderListTabCounts(
  orders: readonly OrderListRow[],
): Record<OrderListTab, number> {
  const counts = {} as Record<OrderListTab, number>;
  for (const { value } of ORDER_LIST_TABS) {
    counts[value] = orders.filter((order) =>
      matchesOrderListTab(order.status, value),
    ).length;
  }
  return counts;
}
