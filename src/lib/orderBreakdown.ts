/**
 * The net / IVA / gross breakdown a client-facing document prints.
 *
 * Every PDF surface used to recompute IVA itself with raw floats (`neto * 0.19`, `neto * 1.19`),
 * so a document could disagree with the charged total by ±1 CLP and its own line breakdown did
 * not add up to its own footer. This module is the single place that derives those columns, and
 * it derives them from the canonical money module (`pricing.ts`).
 *
 * Two rules it guarantees, and that `__tests__/orderBreakdown.test.ts` pins:
 *  1. The footer is the stored authoritative `calculated_*` — never recomputed here.
 *  2. Every column adds up: `sum(lines) == products`, and `products - discount + shipping == totals`.
 *
 * Rounding residue is absorbed by the products row (and, inside it, by the largest line), which
 * is the only place a ±1 CLP is invisible to the reader. Absorbing it in the discount or the
 * shipping row would misquote a figure the customer can check against a coupon or a delivery fee.
 */

import { IVA_RATE, ivaAmount, roundHalfUp } from './pricing';

export { IVA_RATE };

type NumericLike = number | string | null | undefined;

export interface BreakdownLineInput {
  readonly price: NumericLike;
  readonly quantity: NumericLike;
}

export interface OrderBreakdownInput {
  readonly lineItems: readonly BreakdownLineInput[];
  /** `orders.num_jornadas`. Anything unusable falls back to 1 day. */
  readonly jornadas: NumericLike;
  /** Stored `orders.calculated_discount`. */
  readonly discount: NumericLike;
  /** Stored `orders.shipping_total`. */
  readonly shippingTotal: NumericLike;
  /** Stored `orders.calculated_subtotal` — the authoritative net. */
  readonly calculatedSubtotal: NumericLike;
  /** Stored `orders.calculated_iva`. Zero means the order is IVA exempt. */
  readonly calculatedIva: NumericLike;
}

export interface BreakdownRow {
  readonly net: number;
  readonly iva: number;
  readonly gross: number;
}

export interface OrderBreakdown {
  readonly lines: readonly BreakdownRow[];
  readonly products: BreakdownRow;
  readonly discount: BreakdownRow;
  readonly shipping: BreakdownRow;
  /** The stored figures the footer prints. */
  readonly totals: BreakdownRow;
}

function toAmount(value: NumericLike): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;
}

function toJornadas(value: NumericLike): number {
  const parsed = Math.trunc(toAmount(value));
  return parsed >= 1 ? parsed : 1;
}

function row(net: number, iva: number): BreakdownRow {
  return { net, iva, gross: net + iva };
}

/** Index of the biggest raw value — where a ±1 rounding residue is least visible. */
function largestIndex(values: readonly number[]): number {
  let best = 0;
  for (let index = 1; index < values.length; index++) {
    if ((values[index] ?? 0) > (values[best] ?? 0)) best = index;
  }
  return best;
}

/** Rounds each raw value half-up and pushes the difference against `target` onto the largest one. */
function allocate(raws: readonly number[], target: number): number[] {
  const rounded = raws.map(roundHalfUp);
  if (rounded.length === 0) return rounded;
  const residual = target - rounded.reduce((sum, value) => sum + value, 0);
  if (residual !== 0) {
    const index = largestIndex(rounded);
    rounded[index] = (rounded[index] ?? 0) + residual;
  }
  return rounded;
}

export function orderBreakdown(input: OrderBreakdownInput): OrderBreakdown {
  const jornadas = toJornadas(input.jornadas);
  const discountNet = roundHalfUp(Math.max(0, toAmount(input.discount)));
  const shippingNet = roundHalfUp(Math.max(0, toAmount(input.shippingTotal)));
  const totalsNet = roundHalfUp(toAmount(input.calculatedSubtotal));
  const totalsIva = roundHalfUp(toAmount(input.calculatedIva));

  // Derived, not summed: the footer is authoritative, so the products row is whatever makes the
  // net column reconcile with it. For an order priced by `computeOrderTotals` this is exactly the
  // sum of the line subtotals; for a stale one it absorbs the drift.
  const productsNet = totalsNet + discountNet - shippingNet;

  const rawLineNets = input.lineItems.map(
    item => Math.max(0, toAmount(item.price)) * Math.max(0, toAmount(item.quantity)) * jornadas
  );
  const lineNets = allocate(rawLineNets, productsNet);

  const exempt = totalsIva === 0;
  const discountIva = exempt ? 0 : ivaAmount(discountNet);
  const shippingIva = exempt ? 0 : ivaAmount(shippingNet);
  const productsIva = exempt ? 0 : totalsIva + discountIva - shippingIva;
  const lineIvas = exempt
    ? lineNets.map(() => 0)
    : allocate(lineNets.map(net => (net * 19) / 100), productsIva);

  return {
    lines: lineNets.map((net, index) => row(net, lineIvas[index] ?? 0)),
    products: row(productsNet, productsIva),
    discount: row(discountNet, discountIva),
    shipping: row(shippingNet, shippingIva),
    totals: row(totalsNet, totalsIva),
  };
}
