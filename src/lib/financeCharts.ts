/**
 * Finanzas & Cobranza — the Finanzas tab (R-03b), as pure aggregations.
 *
 * Source: `MarioHans_OS_Area01_Finanzas_Cobranza_Canonical_RC2.1.4.html`. Only the canon blocks
 * the data can back are built here: the "Salud Financiera" index has no defined inputs and the
 * schema carries no history to compare a year against, so neither is computed.
 *
 * Every money figure goes through `lib/finance.ts` (`collectedAmount`, `outstandingAmount`), so a
 * reserve agreed away from the 25% default counts the same here as on the Pendientes tab.
 */

import { canonicalStatus } from "./orderStatus";
import { businessDay } from "./businessDay";
import {
  collectedAmount,
  outstandingAmount,
  type FinanceOrderLike,
} from "./finance";

export type ClientType = "natural" | "empresa";

export interface ChartOrder extends FinanceOrderLike {
  /**
   * `orders.date_created` — the month an order counts in. The same basis as the Ingresos series
   * of Rentabilidad (`profitabilityService`), so both screens agree on a month's income.
   */
  readonly createdAt: string | null;
  readonly client: string;
  /** `user_profiles.tipo_cliente` of the customer; null when the profile does not say. */
  readonly clientType: ClientType | null;
  readonly invoiceNumber: string | null;
}

export interface MonthPoint {
  /** `YYYY-MM`, business zone. */
  month: string;
  /** Invoiced: order totals, cancellations excluded. */
  ingresos: number;
  /** Collected so far on those orders, reserves included. */
  cobrado: number;
  /** Still owed on those orders. */
  pendiente: number;
  /** `ingresos − cobrado`: the canon's Flujo de Caja gap. */
  brecha: number;
  pedidos: number;
}

export interface IncomeSlice {
  key: ClientType | "sin-tipo";
  label: string;
  value: number;
  /** Whole percentage of the income shown. */
  share: number;
}

export interface TopClient {
  client: string;
  clientType: ClientType | null;
  total: number;
  orders: number;
  /** Whole percentage of the client's invoiced money already collected. */
  cobranza: number;
}

export interface DueSoonRow {
  id: number;
  reference: string;
  client: string;
  endDate: string | null;
  outstanding: number;
}

export interface FinanceCharts {
  /** First month of the window, `YYYY-MM`. */
  windowStart: string;
  months: MonthPoint[];
  composition: IncomeSlice[];
  collectionRate: number | null;
  /** Days sales outstanding over the window — see `daysSalesOutstanding`. */
  dso: number | null;
  reserves: { cobradas: number; pendientes: number };
  invoices: { emitidas: number; pendientes: number };
  topClients: TopClient[];
}

const DAY_MS = 86_400_000;

function isCancelled(order: Pick<FinanceOrderLike, "status">): boolean {
  return canonicalStatus(order.status) === "cancelled";
}

function billable<T extends FinanceOrderLike>(orders: readonly T[]): T[] {
  return orders.filter((o) => !isCancelled(o));
}

function money(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/** `YYYY-MM` of an instant in the business zone; a bare date is already a calendar day. */
function monthOf(value: string | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(0, 7);
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  return businessDay(instant).slice(0, 7);
}

function percent(part: number, whole: number): number {
  return Math.round((part / whole) * 100);
}

/** The last `count` business months, oldest first, ending with the month of `now`. */
export function trailingMonths(now: Date, count = 12): string[] {
  const [year, month] = businessDay(now).split("-").map(Number) as [
    number,
    number,
  ];
  const keys: string[] = [];
  for (let back = count - 1; back >= 0; back--) {
    const index = year * 12 + (month - 1) - back;
    const y = Math.floor(index / 12);
    const m = (index % 12) + 1;
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return keys;
}

/**
 * The 12-month series behind Ingresos, Cobrado vs. Pendiente, Pedidos Realizados and Flujo de
 * Caja. Collections are dated by the order's month, not the day the money came in: no payment
 * date exists for older orders (`date_paid` was never written before R-03a).
 */
export function monthlyFinance(
  orders: readonly ChartOrder[],
  now: Date,
  months = 12,
): MonthPoint[] {
  const points = new Map<string, MonthPoint>(
    trailingMonths(now, months).map((month) => [
      month,
      { month, ingresos: 0, cobrado: 0, pendiente: 0, brecha: 0, pedidos: 0 },
    ]),
  );

  for (const order of billable(orders)) {
    const point = points.get(monthOf(order.createdAt) ?? "");
    if (!point) continue;
    point.ingresos += money(order.total);
    point.cobrado += collectedAmount(order);
    point.pendiente += outstandingAmount(order);
    point.pedidos += 1;
  }

  return [...points.values()].map((point) => ({
    ...point,
    brecha: point.ingresos - point.cobrado,
  }));
}

const SLICE_LABELS: Record<IncomeSlice["key"], string> = {
  empresa: "Empresa",
  natural: "Persona natural",
  "sin-tipo": "Sin tipo",
};

/** Composición del Ingreso: income by `tipo_cliente`, empty slices left out. */
export function incomeComposition(
  orders: readonly ChartOrder[],
): IncomeSlice[] {
  const sums: Record<IncomeSlice["key"], number> = {
    empresa: 0,
    natural: 0,
    "sin-tipo": 0,
  };
  for (const order of billable(orders)) {
    sums[order.clientType ?? "sin-tipo"] += money(order.total);
  }
  const total = sums.empresa + sums.natural + sums["sin-tipo"];
  if (total <= 0) return [];

  return (Object.keys(sums) as IncomeSlice["key"][])
    .filter((key) => sums[key] > 0)
    .map((key) => ({
      key,
      label: SLICE_LABELS[key],
      value: sums[key],
      share: percent(sums[key], total),
    }));
}

function invoicedAndCollected(orders: readonly ChartOrder[]) {
  let invoiced = 0;
  let collected = 0;
  let owed = 0;
  for (const order of billable(orders)) {
    invoiced += money(order.total);
    collected += collectedAmount(order);
    owed += outstandingAmount(order);
  }
  return { invoiced, collected, owed };
}

/** Tasa de cobranza: collected over invoiced; null when nothing was invoiced. */
export function collectionRate(orders: readonly ChartOrder[]): number | null {
  const { invoiced, collected } = invoicedAndCollected(orders);
  return invoiced > 0 ? percent(collected, invoiced) : null;
}

/**
 * DSO — Días para cobrar, by the standard formula: money still owed over money invoiced, times
 * the days of the window. Payment dates would allow an exact average, but older orders have none.
 */
export function daysSalesOutstanding(
  orders: readonly ChartOrder[],
  windowDays: number,
): number | null {
  const { invoiced, owed } = invoicedAndCollected(orders);
  return invoiced > 0 ? Math.round((owed / invoiced) * windowDays) : null;
}

/** Reservas cobradas vs. pendientes. A fully paid order has its reserve in. */
export function reserveStatus(orders: readonly ChartOrder[]): {
  cobradas: number;
  pendientes: number;
} {
  const live = billable(orders);
  const cobradas = live.filter((o) => o.reservePaid || o.fullyPaid).length;
  return { cobradas, pendientes: live.length - cobradas };
}

/** Facturas emitidas vs. pendientes, read off `orders.numero_factura`. */
export function invoiceStatus(orders: readonly ChartOrder[]): {
  emitidas: number;
  pendientes: number;
} {
  const live = billable(orders);
  const emitidas = live.filter((o) => (o.invoiceNumber ?? "").trim()).length;
  return { emitidas, pendientes: live.length - emitidas };
}

/** Top Clientes del Período: by invoiced money, with how much of it came in. */
export function topClients(
  orders: readonly ChartOrder[],
  limit = 5,
): TopClient[] {
  const byClient = new Map<
    string,
    {
      clientType: ClientType | null;
      total: number;
      collected: number;
      orders: number;
    }
  >();
  for (const order of billable(orders)) {
    const entry = byClient.get(order.client) ?? {
      clientType: order.clientType,
      total: 0,
      collected: 0,
      orders: 0,
    };
    entry.total += money(order.total);
    entry.collected += collectedAmount(order);
    entry.orders += 1;
    entry.clientType ??= order.clientType;
    byClient.set(order.client, entry);
  }

  return [...byClient.entries()]
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, limit)
    .map(([client, entry]) => ({
      client,
      clientType: entry.clientType,
      total: entry.total,
      orders: entry.orders,
      cobranza: entry.total > 0 ? percent(entry.collected, entry.total) : 0,
    }));
}

/**
 * Por Vencer — Próximos 7 Días: balances that fall due (on the return day, per the business
 * rule) from today through `days` ahead, soonest first. Already overdue rows are not here: the
 * Pendientes tab lists those first.
 */
export function dueSoon<T extends DueSoonRow>(
  rows: readonly T[],
  now: Date,
  days = 7,
): Array<T & { daysLeft: number }> {
  const today = Date.parse(`${businessDay(now)}T00:00:00Z`);
  return rows
    .filter((row) => row.outstanding > 0 && row.endDate)
    .map((row) => ({
      ...row,
      daysLeft: Math.round(
        (Date.parse(`${row.endDate!.slice(0, 10)}T00:00:00Z`) - today) / DAY_MS,
      ),
    }))
    .filter((row) => row.daysLeft >= 0 && row.daysLeft <= days)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Everything the Finanzas tab draws, over the trailing `months` window. */
export function buildFinanceCharts(
  orders: readonly ChartOrder[],
  now: Date,
  months = 12,
): FinanceCharts {
  const keys = trailingMonths(now, months);
  const inWindow = new Set(keys);
  const windowOrders = orders.filter((o) =>
    inWindow.has(monthOf(o.createdAt) ?? ""),
  );
  const windowStart = keys[0]!;
  const windowDays = Math.max(
    1,
    Math.round(
      (Date.parse(`${businessDay(now)}T00:00:00Z`) -
        Date.parse(`${windowStart}-01T00:00:00Z`)) /
        DAY_MS,
    ) + 1,
  );

  return {
    windowStart,
    months: monthlyFinance(windowOrders, now, months),
    composition: incomeComposition(windowOrders),
    collectionRate: collectionRate(windowOrders),
    dso: daysSalesOutstanding(windowOrders, windowDays),
    reserves: reserveStatus(windowOrders),
    invoices: invoiceStatus(windowOrders),
    topClients: topClients(windowOrders),
  };
}
