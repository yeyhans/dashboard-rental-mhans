import { describe, expect, it } from 'vitest';

import { computeSelectorPricing } from '../productSelectorPricing';
import { computeOrderTotals } from '../../../lib/pricing';

/**
 * The selector preview is the number the admin reads before saving. It has to agree, to the peso,
 * with what `computeOrderTotals` stores — otherwise the order lands at a different amount than the
 * one that was quoted on screen.
 */
describe('computeSelectorPricing', () => {
  it('matches computeOrderTotals line by line for a fractional unit price over several jornadas', () => {
    const lines = [
      { price: 33333.33, quantity: 1 },
      { price: 8333.335, quantity: 3 },
      { price: 1000.5, quantity: 2 },
    ];
    const jornadas = 3;

    const expected = computeOrderTotals({ lineItems: lines, jornadas });
    const preview = computeSelectorPricing(lines, jornadas);

    expect(preview.lineAmounts).toEqual(expected.lines.map((line) => line.subtotal));
    expect(preview.baseLineAmounts).toEqual(
      computeOrderTotals({ lineItems: lines, jornadas: 1 }).lines.map((line) => line.subtotal),
    );
    expect(preview.totalWithDays).toBe(expected.productsSubtotal);
    preview.lineAmounts.forEach((amount) => expect(Number.isInteger(amount)).toBe(true));
  });

  it('rounds each line before summing, like the server does', () => {
    // Naive float math sums 1000.5 + 1000.5 = 2001; the stored subtotal is 1001 + 1001 = 2002.
    const lines = [
      { price: 1000.5, quantity: 1 },
      { price: 1000.5, quantity: 1 },
    ];

    const preview = computeSelectorPricing(lines, 1);

    expect(preview.subtotal).toBe(2002);
    expect(preview.totalWithDays).toBe(2002);
    expect(preview.lineAmounts).toEqual([1001, 1001]);
  });

  it('reports the single-jornada subtotal separately from the full-rental total', () => {
    const lines = [{ price: 12345.67, quantity: 2 }];

    const preview = computeSelectorPricing(lines, 4);

    expect(preview.subtotal).toBe(computeOrderTotals({ lineItems: lines, jornadas: 1 }).productsSubtotal);
    expect(preview.totalWithDays).toBe(computeOrderTotals({ lineItems: lines, jornadas: 4 }).productsSubtotal);
    expect(preview.itemCount).toBe(2);
  });

  it('falls back to zero instead of throwing on malformed rows', () => {
    const preview = computeSelectorPricing(
      [
        { price: Number.NaN, quantity: 1 },
        { price: 1000, quantity: 2 },
      ],
      2,
    );

    expect(preview.lineAmounts).toEqual([0, 4000]);
    expect(preview.totalWithDays).toBe(4000);
  });

  it('treats a missing or invalid day count as one jornada', () => {
    const lines = [{ price: 5000, quantity: 1 }];

    expect(computeSelectorPricing(lines, 0).totalWithDays).toBe(5000);
    expect(computeSelectorPricing(lines, 1.5).totalWithDays).toBe(5000);
    expect(computeSelectorPricing(lines, Number.NaN).totalWithDays).toBe(5000);
  });
});
