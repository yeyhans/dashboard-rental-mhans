/**
 * Catálogo de Equipos — availability, derived per date.
 *
 * Source: `Área 01 · Rental Técnico/OFF/MarioHans_OS_Area01_Catalogo_Equipos_Canonical_RC2.1.3.html`,
 * whose subtitle is "Inventario de activos físicos con disponibilidad en tiempo real" and whose
 * indicator row is Modelos Publicados / Disponibles Hoy / En Arriendo / Mantención-Bloqueadas.
 *
 * The schema has no serialised inventory: `products` carries a `stock_status` varchar with no
 * CHECK and no per-unit table, so "how many units of this model exist" is not recorded anywhere.
 * What IS recoverable is occupancy: a model is out on rental today if it appears in the
 * `line_items` of an order whose date range covers today. That is a real answer to the module's
 * own question and it needs no new schema.
 *
 * The honest limit: occupancy is counted in units SOLD, not units OWNED. Without an inventory
 * table there is no denominator, so this reports what is out — never "3 of 5 available", which
 * would be a fabricated ratio.
 */

import { canonicalStatus } from './orderStatus';
import type { LineItem } from '../types/order';

/** `products.stock_status`, by convention — the column has no CHECK constraint. */
export const STOCK_STATUSES = ['instock', 'outofstock', 'onbackorder'] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

export const STOCK_LABELS: Record<StockStatus, string> = {
  instock: 'Disponible',
  outofstock: 'No disponible',
  onbackorder: 'Bajo pedido',
};

export function stockLabel(value: string): string {
  return (STOCK_LABELS as Record<string, string>)[value] ?? value;
}

export interface RentalWindowLike {
  readonly status: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly lineItems: readonly LineItem[];
}

function isoDay(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Whether the order holds equipment on `day`.
 *
 * Both ends are inclusive: on the last day the gear is still with the customer — the return is
 * only due at 13:00 the FOLLOWING day. Treating the end date as exclusive is how a model gets
 * double-booked for the final day of a shoot.
 */
export function coversDay(order: RentalWindowLike, day: string): boolean {
  if (canonicalStatus(order.status) === 'cancelled') return false;
  if (!order.startDate || !order.endDate) return false;
  return isoDay(order.startDate) <= day && day <= isoDay(order.endDate);
}

/** Units of each product committed on `day`, keyed by product id as a string. */
export function occupancyOn(orders: readonly RentalWindowLike[], now: Date): Map<string, number> {
  const day = isoDay(now);
  const occupied = new Map<string, number>();

  for (const order of orders) {
    if (!coversDay(order, day)) continue;
    for (const item of order.lineItems) {
      if (item?.product_id == null) continue;
      const id = String(item.product_id);
      occupied.set(id, (occupied.get(id) ?? 0) + (Number(item.quantity) || 0));
    }
  }

  return occupied;
}

export interface CatalogProductLike {
  readonly id: number | string;
  readonly status: string;
  readonly stockStatus: string;
}

export interface CatalogKpis {
  modelosPublicados: number;
  /** Published models with nothing out today and stock marked available. */
  disponiblesHoy: number;
  /** Share of published models available, 0–100. */
  porcentajeDisponible: number;
  /** Published models with at least one unit out today. */
  modelosEnArriendo: number;
  /** Units out today, across every model. */
  unidadesEnArriendo: number;
  /** Published models flagged out-of-stock or on backorder. */
  bloqueados: number;
}

/**
 * The indicator row.
 *
 * Only published models count: a draft is not part of the offer, and including drafts would make
 * "Disponibles Hoy" drift away from what a customer can actually book.
 */
export function catalogKpis(
  products: readonly CatalogProductLike[],
  occupied: ReadonlyMap<string, number>
): CatalogKpis {
  const published = products.filter(p => p.status === 'publish');

  let disponiblesHoy = 0;
  let modelosEnArriendo = 0;
  let unidadesEnArriendo = 0;
  let bloqueados = 0;

  for (const product of published) {
    const out = occupied.get(String(product.id)) ?? 0;
    const blocked = product.stockStatus !== 'instock';

    if (out > 0) {
      modelosEnArriendo++;
      unidadesEnArriendo += out;
    }
    if (blocked) bloqueados++;
    else if (out === 0) disponiblesHoy++;
  }

  return {
    modelosPublicados: published.length,
    disponiblesHoy,
    porcentajeDisponible:
      published.length > 0 ? Math.round((disponiblesHoy / published.length) * 100) : 0,
    modelosEnArriendo,
    unidadesEnArriendo,
    bloqueados,
  };
}
