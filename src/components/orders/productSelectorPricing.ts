/**
 * Money for the product-selector preview.
 *
 * Kept out of the component (and framework-free) so it can be held against `computeOrderTotals`
 * in a test: the amounts the admin reads before saving must be the amounts the server stores.
 * The selector used to multiply by the day count itself with `Math.round(x * 100) / 100`, which
 * drifts from the half-up, round-per-line rule the rest of the system follows.
 */

import { computeOrderTotals, roundHalfUp } from '../../lib/pricing';

export interface SelectorPricingLine {
  readonly price: number;
  readonly quantity: number;
}

export interface SelectorPricing {
  /** Per-line amount for the whole rental, aligned with `OrderTotals.lines[i].subtotal`. */
  readonly lineAmounts: readonly number[];
  /** Per-line amount for a single jornada (price x quantity), rounded the same way. */
  readonly baseLineAmounts: readonly number[];
  /** Products subtotal for a single jornada. */
  readonly subtotal: number;
  /** Products subtotal for `numDays` jornadas; equals `OrderTotals.productsSubtotal`. */
  readonly totalWithDays: number;
  readonly itemCount: number;
}

/** The selector renders while the form is still half-filled, so an invalid count means "one day". */
function normalizeJornadas(numDays: number): number {
  return Number.isInteger(numDays) && numDays >= 1 ? numDays : 1;
}

function priceLines(lines: readonly SelectorPricingLine[], jornadas: number): number[] {
  try {
    return computeOrderTotals({ lineItems: lines, jornadas }).lines.map((line) => line.subtotal);
  } catch {
    // One malformed row must not blank out the whole preview; price the rest anyway.
    return lines.map((line) => {
      const amount = Number(line.price) * Number(line.quantity) * jornadas;
      return Number.isFinite(amount) && amount > 0 ? roundHalfUp(amount) : 0;
    });
  }
}

function sum(values: readonly number[]): number {
  return values.reduce((accumulator, value) => accumulator + value, 0);
}

export function computeSelectorPricing(
  lines: readonly SelectorPricingLine[],
  numDays: number,
): SelectorPricing {
  const jornadas = normalizeJornadas(numDays);
  const lineAmounts = priceLines(lines, jornadas);
  const baseAmounts = jornadas === 1 ? lineAmounts : priceLines(lines, 1);

  return {
    lineAmounts,
    baseLineAmounts: baseAmounts,
    subtotal: sum(baseAmounts),
    totalWithDays: sum(lineAmounts),
    itemCount: lines.reduce(
      (accumulator, line) => accumulator + (Number.isFinite(line.quantity) ? line.quantity : 0),
      0,
    ),
  };
}
