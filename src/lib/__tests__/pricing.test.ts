import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BALANCE_LABEL,
  IVA_RATE,
  PricingError,
  computeDiscount,
  computeOrderTotals,
  countJornadas,
  reserveLabel,
  type PricingCoupon,
  type PricingLineInput,
} from '../pricing';
import { reserveAmount } from '../finance';

interface GoldenInput {
  line_items: PricingLineInput[];
  start_date?: string;
  end_date?: string;
  shipping_total?: number | string;
  coupon?: PricingCoupon | null;
  discount?: number | null;
  apply_iva?: boolean;
  reserve_type?: string;
  reserve_value?: number | string;
}

interface GoldenCase {
  name: string;
  note: string;
  input: GoldenInput;
  expected: {
    jornadas: number;
    line_subtotals: number[];
    products_subtotal: number;
    discount: number;
    shipping_total: number;
    net: number;
    iva: number;
    total: number;
    reserve: number;
    balance: number;
    reserve_label: string;
  };
}

interface GoldenFile {
  cases: GoldenCase[];
  error_cases: { name: string; input: GoldenInput }[];
}

const golden = JSON.parse(
  readFileSync(new URL('../__fixtures__/pricing-golden.json', import.meta.url), 'utf8')
) as GoldenFile;

function run(input: GoldenInput) {
  return computeOrderTotals({
    lineItems: input.line_items,
    startDate: input.start_date,
    endDate: input.end_date,
    shippingTotal: input.shipping_total,
    coupon: input.coupon ?? null,
    discount: input.discount ?? null,
    applyIva: input.apply_iva ?? true,
    reserveType: input.reserve_type,
    reserveValue: input.reserve_value,
  });
}

describe('pricing golden fixtures', () => {
  it('ships a non-trivial set of cases', () => {
    expect(golden.cases.length).toBeGreaterThanOrEqual(15);
  });

  it.each(golden.cases.map(c => [c.name, c] as const))('%s', (_name, fixture) => {
    const result = run(fixture.input);
    const e = fixture.expected;

    expect({
      jornadas: result.jornadas,
      line_subtotals: result.lines.map(l => l.subtotal),
      products_subtotal: result.productsSubtotal,
      discount: result.discount,
      shipping_total: result.shippingTotal,
      net: result.net,
      iva: result.iva,
      total: result.total,
      reserve: result.reserve,
      balance: result.balance,
      reserve_label: result.reserveLabel,
    }).toEqual(e);
  });

  it.each(golden.error_cases.map(c => [c.name, c] as const))('rejects %s', (_name, fixture) => {
    expect(() => run(fixture.input)).toThrow(PricingError);
  });
});

describe('countJornadas', () => {
  it('counts inclusive calendar days', () => {
    expect(countJornadas('2027-03-01', '2027-03-03')).toBe(3);
    expect(countJornadas('2027-03-01', '2027-03-01')).toBe(1);
  });

  it('is independent of the process time zone across the Santiago DST change', () => {
    const previous = process.env.TZ;
    try {
      process.env.TZ = 'America/Santiago';
      expect(countJornadas('2027-04-02', '2027-04-05')).toBe(4);
      expect(countJornadas('2027-09-03', '2027-09-06')).toBe(4);
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });

  it('accepts a timestamp and uses only its date part', () => {
    expect(countJornadas('2027-04-02T00:00:00.000Z', '2027-04-05')).toBe(4);
  });

  it('rejects impossible calendar dates', () => {
    expect(() => countJornadas('2027-02-30', '2027-03-01')).toThrow(PricingError);
  });

  it('rejects an end before the start', () => {
    expect(() => countJornadas('2027-03-02', '2027-03-01')).toThrow(PricingError);
  });
});

describe('computeDiscount', () => {
  it('is zero without a coupon', () => {
    expect(computeDiscount(null, 10000)).toBe(0);
  });

  it('keeps fixed_product as a flat amount for now', () => {
    expect(computeDiscount({ discount_type: 'fixed_product', amount: 3000 }, 10000)).toBe(3000);
  });

  it('ignores an unknown discount type', () => {
    expect(computeDiscount({ discount_type: 'bogus', amount: 3000 }, 10000)).toBe(0);
  });

  it('never goes negative or above the products subtotal', () => {
    expect(computeDiscount({ discount_type: 'fixed_cart', amount: -500 }, 10000)).toBe(0);
    expect(computeDiscount({ discount_type: 'percent', amount: 150 }, 10000)).toBe(10000);
  });

  it('accepts string amounts from PostgREST numeric columns', () => {
    expect(
      computeDiscount({ discount_type: 'percent', amount: '10.00', maximum_amount: '500.00' }, 10000)
    ).toBe(500);
  });
});

describe('computeOrderTotals', () => {
  it('uses an explicit jornadas count when there are no dates', () => {
    const result = computeOrderTotals({ lineItems: [{ price: 1000, quantity: 1 }], jornadas: 2 });
    expect(result.jornadas).toBe(2);
    expect(result.total).toBe(2380);
  });

  it('rejects a missing day count', () => {
    expect(() => computeOrderTotals({ lineItems: [{ price: 1000, quantity: 1 }] })).toThrow(
      PricingError
    );
  });

  it('clamps a manual discount to the products subtotal and leaves shipping intact', () => {
    const result = computeOrderTotals({
      lineItems: [{ price: 1000, quantity: 1 }],
      jornadas: 1,
      shippingTotal: 5000,
      discount: 9000,
    });
    expect(result.discount).toBe(1000);
    expect(result.net).toBe(5000);
  });

  it('prefers the coupon over a manual discount', () => {
    const result = computeOrderTotals({
      lineItems: [{ price: 1000, quantity: 1 }],
      jornadas: 1,
      coupon: { discount_type: 'fixed_cart', amount: 100 },
      discount: 900,
    });
    expect(result.discount).toBe(100);
  });

  it('defaults to IVA applied and a 25% reserve', () => {
    const result = computeOrderTotals({ lineItems: [{ price: 10000, quantity: 1 }], jornadas: 1 });
    expect(result.iva).toBe(1900);
    expect(result.reserve).toBe(2975);
    expect(result.reserveLabel).toBe('Reserva 25%');
  });

  it('agrees with finance.reserveAmount', () => {
    const result = computeOrderTotals({
      lineItems: [{ price: 33333, quantity: 1 }],
      jornadas: 1,
      reserveType: 'percent',
      reserveValue: 30,
    });
    expect(result.reserve).toBe(
      reserveAmount({ total: result.total, reserveType: 'percent', reserveValue: 30 })
    );
  });
});

describe('labels', () => {
  it('formats percentages without trailing zeros', () => {
    expect(reserveLabel('percent', '30.00')).toBe('Reserva 30%');
    expect(reserveLabel('percent', 12.5)).toBe('Reserva 12,5%');
    expect(reserveLabel(null, null)).toBe('Reserva 25%');
    expect(reserveLabel('fixed', 50000)).toBe('Reserva');
  });

  it('exposes the balance label and the IVA rate', () => {
    expect(BALANCE_LABEL).toBe('Saldo');
    expect(IVA_RATE).toBe(0.19);
  });
});
