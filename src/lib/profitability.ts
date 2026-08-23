/**
 * Rentabilidad — the pure derivations.
 *
 * Source: `Área 01 · Rental Técnico/OFF/MarioHans_OS_Area01_Rentabilidad_Canonical_RC2.1.2.html`,
 * which asks "¿Cuánto gana el negocio y qué tan bien trabajan los activos?" across four tabs.
 *
 * UPDATE (T-026, 2026-08-23): the schema gap this file used to document is closed. Migration
 * `0006_t026_schema_gaps.sql` adds `serialised_assets.acquisition_cost` and a new `expenses`
 * table (11-category enum), so Costos Directos, Gastos Operacionales, Margen Bruto, Utilidad
 * Operacional and ROI por activo now have a schema behind them. That migration has NOT been
 * applied to any database yet (pending staging rehearsal — see `apply-progress.md`, "T-026
 * resuelto"), so the cost/expense/margin/ROI functions below (`expensesByCategory`,
 * `expensesByMonth`, `calculateMargin`, `calculateROI`) are written and tested against the
 * migration's contract ahead of that rehearsal, same as `assetMovementService.ts` /
 * `expenseService.ts`. No canonical formula for margin/ROI was confirmed at the time these were
 * written (the Rentabilidad UI still ships as a placeholder), so they use the standard
 * definitions documented on each function below.
 *
 * What was ALREADY backed by data before T-026: revenue, jornadas sold, average ticket, orders
 * placed, distinct equipment used, the twelve-month revenue series, and asset rotation — the
 * `RevenueOrderLike`-based functions in the first half of this file.
 */

import { canonicalStatus } from './orderStatus';
import type { LineItem } from '../types/order';
import type { ExpenseLike } from '../types/expenses';

export interface RevenueOrderLike {
  readonly status: string;
  readonly total: number;
  readonly jornadas: number;
  readonly createdAt: string | null;
  readonly lineItems: readonly LineItem[];
}

function monthKey(value: string): string {
  return value.slice(0, 7);
}

/** Counts only orders that produced revenue: a cancellation never billed. */
function counts(order: RevenueOrderLike): boolean {
  return canonicalStatus(order.status) !== 'cancelled';
}

export interface PeriodMetrics {
  ingresos: number;
  jornadasVendidas: number;
  pedidosRealizados: number;
  ticketPromedio: number;
  equiposUtilizados: number;
}

/**
 * The metric row of the canonical.
 *
 * `equiposUtilizados` counts DISTINCT products, not line quantity: the question is how many of
 * the catalogue's assets earned money this period, and a single order of ten identical stands
 * would otherwise read as ten working assets.
 */
export function periodMetrics(orders: readonly RevenueOrderLike[]): PeriodMetrics {
  const billable = orders.filter(counts);
  const ingresos = billable.reduce((sum, o) => sum + (Number.isFinite(o.total) ? o.total : 0), 0);
  const productIds = new Set<string>();
  let jornadasVendidas = 0;

  for (const order of billable) {
    jornadasVendidas += Number.isFinite(order.jornadas) ? Math.max(0, order.jornadas) : 0;
    for (const item of order.lineItems) {
      if (item?.product_id != null) productIds.add(String(item.product_id));
    }
  }

  return {
    ingresos,
    jornadasVendidas,
    pedidosRealizados: billable.length,
    ticketPromedio: billable.length > 0 ? Math.round(ingresos / billable.length) : 0,
    equiposUtilizados: productIds.size,
  };
}

export interface MonthlyRevenue {
  month: string;
  ingresos: number;
  pedidos: number;
}

/**
 * The twelve-month series.
 *
 * Months with no orders are emitted as zero rather than skipped: a chart that drops empty months
 * silently compresses the axis and turns a dead quarter into a smooth line.
 */
export function monthlyRevenueSeries(
  orders: readonly RevenueOrderLike[],
  now: Date,
  months = 12
): MonthlyRevenue[] {
  const buckets = new Map<string, MonthlyRevenue>();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
    const key = date.toISOString().slice(0, 7);
    buckets.set(key, { month: key, ingresos: 0, pedidos: 0 });
  }

  for (const order of orders) {
    if (!counts(order) || !order.createdAt) continue;
    const bucket = buckets.get(monthKey(order.createdAt));
    if (!bucket) continue;
    bucket.ingresos += Number.isFinite(order.total) ? order.total : 0;
    bucket.pedidos++;
  }

  return [...buckets.values()];
}

export interface AssetRotation {
  productId: string;
  name: string;
  rentals: number;
  jornadas: number;
  revenue: number;
}

/**
 * Rotation per asset, most-used first.
 *
 * Revenue is attributed per line as `price × quantity × jornadas`, matching the order arithmetic
 * in the project rules. Attributing the order total to each of its items would count the same
 * money once per line and inflate every asset in a multi-item order.
 */
export function assetRotation(orders: readonly RevenueOrderLike[]): AssetRotation[] {
  const byProduct = new Map<string, AssetRotation>();

  for (const order of orders) {
    if (!counts(order)) continue;
    const jornadas = Number.isFinite(order.jornadas) ? Math.max(0, order.jornadas) : 0;

    for (const item of order.lineItems) {
      if (item?.product_id == null) continue;
      const id = String(item.product_id);
      const entry = byProduct.get(id) ?? { productId: id, name: item.name, rentals: 0, jornadas: 0, revenue: 0 };
      const quantity = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;

      entry.rentals++;
      entry.jornadas += jornadas * quantity;
      entry.revenue += price * quantity * jornadas;
      byProduct.set(id, entry);
    }
  }

  return [...byProduct.values()].sort((a, b) => b.revenue - a.revenue || b.rentals - a.rentals);
}

/**
 * Catalogue assets that earned nothing in the period.
 *
 * This is the one "Atención" item the canonical lists that the data CAN answer: an asset absent
 * from every order is idle capital, and naming it is actionable without knowing its cost.
 */
export function idleAssets(
  catalogue: ReadonlyArray<{ id: number | string; name: string | null }>,
  rotation: readonly AssetRotation[]
): Array<{ id: string; name: string }> {
  const used = new Set(rotation.map(r => r.productId));
  return catalogue
    .filter(product => !used.has(String(product.id)))
    // `products.name` es nullable. Sin este respaldo la fila se renderiza vacia y el admin ve un
    // item en blanco en la lista de capital ocioso, sin forma de saber a que equipo se refiere.
    .map(product => ({ id: String(product.id), name: product.name ?? `Equipo #${product.id}` }));
}

/** Percentage change against the previous period, or `null` when there is no base. */
export function growth(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// =============================================================================================
// T-026 gap 3 (Costos/Gastos/Margen/ROI). See the module header for the migration-status caveat.
// =============================================================================================

/** Sums `amount` per `category`. Categories with no expenses are simply absent from the result. */
export function expensesByCategory(expenses: readonly ExpenseLike[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const expense of expenses) {
    totals[expense.category] = (totals[expense.category] ?? 0) + expense.amount;
  }
  return totals;
}

/** Sums `amount` per `YYYY-MM`, derived from `expense_date` (ISO 8601, day precision or full timestamp). */
export function expensesByMonth(expenses: readonly ExpenseLike[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const expense of expenses) {
    const month = expense.expense_date.slice(0, 7);
    totals[month] = (totals[month] ?? 0) + expense.amount;
  }
  return totals;
}

export interface MarginResult {
  margin: number;
  /** `null` when `revenue` is 0 — avoids `Infinity`/`NaN` from dividing by zero, same convention
   *  as `growth` above. */
  marginPercentage: number | null;
}

export function calculateMargin(revenue: number, expenses: number): MarginResult {
  const margin = revenue - expenses;
  return {
    margin,
    marginPercentage: revenue === 0 ? null : (margin / revenue) * 100,
  };
}

/**
 * `null` when `acquisitionCost` is 0, missing, or not finite — mirrors `serialised_assets
 * .acquisition_cost` being a nullable column (migration comment: "cost per physical unit", not
 * guaranteed to be recorded for every unit).
 */
export function calculateROI(profit: number, acquisitionCost: number | null | undefined): number | null {
  if (acquisitionCost == null || !Number.isFinite(acquisitionCost) || acquisitionCost === 0) {
    return null;
  }
  return profit / acquisitionCost;
}
