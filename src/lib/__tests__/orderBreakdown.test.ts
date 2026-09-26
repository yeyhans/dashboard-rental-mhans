import { describe, expect, it } from 'vitest';
import { orderBreakdown } from '../orderBreakdown';

/**
 * A representative order whose products subtotal only comes out right with half-up rounding:
 * 1000.5 x 3 x 2 = 6003 exactly, and the discount IVA lands on .57.
 */
const order = {
  lineItems: [
    { price: 1000.5, quantity: 3 },
    { price: 2500, quantity: 1 },
  ],
  jornadas: 2,
  discount: 1003,
  shippingTotal: 5000,
  // Stored authoritative columns, as computeOrderTotals produced them.
  calculatedSubtotal: 15000,
  calculatedIva: 2850,
};

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

describe('orderBreakdown', () => {
  it('keeps the stored calculated_* values as the footer figures', () => {
    const breakdown = orderBreakdown(order);

    expect(breakdown.totals).toEqual({ net: 15000, iva: 2850, gross: 17850 });
  });

  it('rounds each line half-up and sums the lines to the products row', () => {
    const breakdown = orderBreakdown(order);

    expect(breakdown.lines.map(line => line.net)).toEqual([6003, 5000]);
    expect(breakdown.products.net).toBe(11003);
    expect(sum(breakdown.lines.map(line => line.iva))).toBe(breakdown.products.iva);
    expect(sum(breakdown.lines.map(line => line.gross))).toBe(breakdown.products.gross);
  });

  it('reconciles the breakdown with the footer on all three columns', () => {
    const breakdown = orderBreakdown(order);
    const { products, discount, shipping, totals } = breakdown;

    expect(products.net - discount.net + shipping.net).toBe(totals.net);
    expect(products.iva - discount.iva + shipping.iva).toBe(totals.iva);
    expect(products.gross - discount.gross + shipping.gross).toBe(totals.gross);
  });

  it('gives every row an integer gross equal to net plus iva', () => {
    const breakdown = orderBreakdown(order);

    for (const row of [...breakdown.lines, breakdown.products, breakdown.discount, breakdown.shipping, breakdown.totals]) {
      expect(Number.isInteger(row.net)).toBe(true);
      expect(Number.isInteger(row.iva)).toBe(true);
      expect(row.gross).toBe(row.net + row.iva);
    }
  });

  it('rounds a price ending in .5 up, never down', () => {
    const breakdown = orderBreakdown({
      lineItems: [{ price: 100.5, quantity: 1 }],
      jornadas: 1,
      discount: 0,
      shippingTotal: 0,
      calculatedSubtotal: 101,
      calculatedIva: 19,
    });

    expect(breakdown.lines[0]!.net).toBe(101);
    expect(breakdown.totals).toEqual({ net: 101, iva: 19, gross: 120 });
  });

  it('zeroes the whole IVA column for an exempt order', () => {
    const breakdown = orderBreakdown({ ...order, calculatedIva: 0 });

    expect(breakdown.lines.every(line => line.iva === 0)).toBe(true);
    expect(breakdown.products.iva).toBe(0);
    expect(breakdown.discount.iva).toBe(0);
    expect(breakdown.shipping.iva).toBe(0);
    expect(breakdown.totals.gross).toBe(15000);
  });

  it('absorbs a stale stored subtotal into the products row so the column still adds up', () => {
    // An order edited before the pricing unification can carry a subtotal that no longer matches
    // its items. The footer is authoritative, so the residual lands on the largest line.
    const breakdown = orderBreakdown({ ...order, calculatedSubtotal: 15100, calculatedIva: 2869 });

    expect(breakdown.products.net).toBe(11103);
    expect(sum(breakdown.lines.map(line => line.net))).toBe(11103);
    expect(breakdown.products.iva - breakdown.discount.iva + breakdown.shipping.iva).toBe(2869);
  });

  it('tolerates missing items, string numerics and an absent jornadas count', () => {
    const breakdown = orderBreakdown({
      lineItems: [{ price: '5000', quantity: '2' }],
      jornadas: null,
      discount: null,
      shippingTotal: null,
      calculatedSubtotal: '10000',
      calculatedIva: '1900',
    });

    expect(breakdown.lines[0]!.net).toBe(10000);
    expect(breakdown.totals).toEqual({ net: 10000, iva: 1900, gross: 11900 });
  });
});
