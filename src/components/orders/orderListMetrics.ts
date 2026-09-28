import {
  canonicalStatus,
  isTerminalStatus,
  statusesForTab,
  statusTone,
  ORDER_LIST_TABS,
  type OrderListTab,
} from "../../lib/orderStatus";
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
 */
function toIsoDay(value: string | Date): string {
  if (typeof value === "string") return value.slice(0, 10);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
