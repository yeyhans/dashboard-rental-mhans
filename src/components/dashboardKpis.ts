import type { DashboardStats } from "../services/dashboardService";

/** The five top KPI cards the D-04 canon shows above the fold on `/dashboard`. */
export type DashboardKpiKey =
  | "pedidosActivos"
  | "proximasEntregas"
  | "devolucionesHoy"
  | "ingresosMes"
  | "cobrosPendientes";

export interface DashboardKpiItem {
  key: DashboardKpiKey;
  label: string;
  /** Already display-ready: a plain count, a formatted CLP amount, or the empty-state dash. */
  value: string;
  /** True when there is no real source for this KPI yet — `value` is the empty-state dash. */
  isEmpty: boolean;
}

/** Canon empty-state placeholder, not a magic string repeated at call sites. */
export const EMPTY_KPI_VALUE = "—";

function formatClp(amount: number): string {
  return `$${Math.round(amount).toLocaleString("es-CL")}`;
}

/**
 * Maps `DashboardService.getDashboardStats()` onto the D-04 canon's five top KPI cards
 * (Pedidos Activos, Entregas Hoy, Devoluciones Hoy, Ingresos Mes, Cobros Pendientes).
 *
 * Three of the five come straight from `operationalKpis`, computed server-side by
 * `DashboardService.getOperationalKpis()`. `Cobros Pendientes` comes from `financialSummary` by
 * default, unless `unfilteredTotalPending` is given.
 *
 * `Ingresos Mes` has no real source: `financialSummary.totalSales` aggregates every
 * booking-status order regardless of date — not the current calendar month — and
 * `monthlyOrderStats` only counts orders per status, with no revenue figure attached. Rather than
 * silently relabel a lifetime total as "this month" (inventing a number the canon did not ask
 * for), this renders the explicit empty state. See D-04 open items in
 * `odd/tasks/revisiones-cliente.md`.
 *
 * The `proximasEntregas` key still says "Próximas" ("upcoming") in code, but its label was
 * "Próximas Entregas" while its value was always `entregasHoy` — deliveries starting TODAY, not a
 * real upcoming/future count. D-14d relabels it "Entregas Hoy" instead of inventing an upcoming
 * count nothing in `operationalKpis` computes.
 *
 * `unfilteredTotalPending` (D-14c): the caller's `stats.financialSummary.totalPending` may be
 * period-filtered (Centro de Control replaces it with the selected date range's summary). Cobros
 * Pendientes is meant to be the company-wide outstanding balance, not "pending this month", so a
 * caller holding onto the unfiltered initial value passes it here to override the field.
 */
export function mapDashboardKpis(
  stats: DashboardStats,
  unfilteredTotalPending?: number,
): DashboardKpiItem[] {
  const totalPending =
    unfilteredTotalPending ?? stats.financialSummary.totalPending;
  return [
    {
      key: "pedidosActivos",
      label: "Pedidos Activos",
      value: String(stats.operationalKpis.pedidosActivos),
      isEmpty: false,
    },
    {
      key: "proximasEntregas",
      label: "Entregas Hoy",
      value: String(stats.operationalKpis.entregasHoy),
      isEmpty: false,
    },
    {
      key: "devolucionesHoy",
      label: "Devoluciones Hoy",
      value: String(stats.operationalKpis.devolucionesHoy),
      isEmpty: false,
    },
    {
      key: "ingresosMes",
      label: "Ingresos Mes",
      value: EMPTY_KPI_VALUE,
      isEmpty: true,
    },
    {
      key: "cobrosPendientes",
      label: "Cobros Pendientes",
      value: formatClp(totalPending),
      isEmpty: false,
    },
  ];
}
