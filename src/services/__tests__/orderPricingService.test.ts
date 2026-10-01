import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The server is the only place where an order's money is decided. Client-sent `calculated_*`
 * values are ignored: order #1573 was persisted with a total that left its shipping out because
 * the endpoint trusted the browser.
 */
const getCouponByCode = vi.hoisted(() => vi.fn());
type Eligibility = { eligible: boolean; reason: string | null };
const couponEligibility = vi.hoisted(() =>
  vi.fn(async (): Promise<Eligibility> => ({ eligible: true, reason: null }))
);

// couponCodeFromLines is pure; loading the real module only needs the admin client stubbed.
vi.mock('../../lib/supabase', () => ({ supabaseAdmin: {} }));

vi.mock('../couponService', async (importOriginal) => ({
  couponCodeFromLines: (await importOriginal<typeof import('../couponService')>())
    .couponCodeFromLines,
  CouponService: { getCouponByCode, couponEligibility },
}));

const { OrderPricingService } = await import('../orderPricingService');
const { PricingError } = await import('../../lib/pricing');

const order1573 = {
  line_items: [
    { name: 'Canon Mount Adapter EF-EOS R', price: 12000, quantity: 1, product_id: 3085 },
    { name: 'Profoto Clic Softbox Octa', price: 15000, quantity: 1, product_id: 52 },
  ],
  order_fecha_inicio: '2026-09-20',
  order_fecha_termino: '2026-09-22',
  num_jornadas: 3,
  shipping_total: 15000,
  coupon_lines: [],
};

beforeEach(() => {
  getCouponByCode.mockReset();
  couponEligibility.mockReset();
  couponEligibility.mockResolvedValue({ eligible: true, reason: null });
});

describe('OrderPricingService.priceNewOrder', () => {
  it('recomputes every money field and ignores the client totals', async () => {
    const fields = await OrderPricingService.priceNewOrder(
      {
        ...order1573,
        num_jornadas: 99,
        calculated_subtotal: 81000,
        calculated_discount: 0,
        calculated_iva: 15390,
        calculated_total: 96390,
      },
      'admin'
    );

    expect(fields).toEqual({
      num_jornadas: 3,
      shipping_total: 15000,
      calculated_subtotal: 96000,
      calculated_discount: 0,
      calculated_iva: 18240,
      calculated_total: 114240,
      total: 114240,
    });
  });

  it('applies a published coupon found by the code in coupon_lines', async () => {
    getCouponByCode.mockResolvedValue({
      code: 'DIEZ',
      status: 'publish',
      discount_type: 'percent',
      amount: 10,
      maximum_amount: null,
    });

    const fields = await OrderPricingService.priceNewOrder(
      { ...order1573, shipping_total: 0, coupon_lines: [{ code: 'DIEZ', discount: '999999' }] },
      'frontend'
    );

    expect(getCouponByCode).toHaveBeenCalledWith('DIEZ');
    expect(fields.calculated_discount).toBe(8100);
    expect(fields.calculated_total).toBe(86751);
  });

  it('does not let a frontend caller set a discount without a coupon', async () => {
    const fields = await OrderPricingService.priceNewOrder(
      { ...order1573, calculated_discount: 50000, coupon_lines: [] },
      'frontend'
    );

    expect(fields.calculated_discount).toBe(0);
  });

  /**
   * Elegibilidad del cupon: la validaba solo el navegador. Un POST directo con un cupon vencido o
   * agotado se calculaba y se persistia con el descuento aplicado.
   */
  describe('coupon eligibility', () => {
    const coupon = {
      id: 7,
      code: 'DIEZ',
      status: 'publish',
      discount_type: 'percent',
      amount: 10,
      maximum_amount: null,
    };

    it('checks eligibility against the products subtotal, not the net', async () => {
      getCouponByCode.mockResolvedValue(coupon);

      await OrderPricingService.priceNewOrder(
        { ...order1573, customer_id: 42, coupon_lines: [{ code: 'DIEZ' }] },
        'frontend'
      );

      // 27000 x 3 jornadas = 81000 en productos; el envio (15000) no cuenta para el minimo.
      expect(couponEligibility).toHaveBeenCalledWith(coupon, 42, 81000);
    });

    it('rejects a customer order that sent a coupon it cannot use', async () => {
      getCouponByCode.mockResolvedValue(coupon);
      couponEligibility.mockResolvedValue({ eligible: false, reason: 'Este cupón ha expirado' });

      await expect(
        OrderPricingService.priceNewOrder(
          { ...order1573, customer_id: 42, coupon_lines: [{ code: 'DIEZ' }] },
          'frontend'
        )
      ).rejects.toThrow('Este cupón ha expirado');
    });

    it('rejects a customer order whose coupon code does not exist', async () => {
      getCouponByCode.mockResolvedValue(null);

      await expect(
        OrderPricingService.priceNewOrder(
          { ...order1573, customer_id: 42, coupon_lines: [{ code: 'NOPE' }] },
          'frontend'
        )
      ).rejects.toBeInstanceOf(PricingError);
    });

    it('drops an ineligible coupon to zero for an admin edit instead of failing', async () => {
      getCouponByCode.mockResolvedValue(coupon);
      couponEligibility.mockResolvedValue({ eligible: false, reason: 'Este cupón ha alcanzado su límite de uso' });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const fields = await OrderPricingService.priceNewOrder(
        { ...order1573, shipping_total: 0, customer_id: 42, coupon_lines: [{ code: 'DIEZ' }] },
        'admin'
      );

      expect(fields.calculated_discount).toBe(0);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  it('keeps a manual discount from an admin caller', async () => {
    const fields = await OrderPricingService.priceNewOrder(
      { ...order1573, shipping_total: 0, calculated_discount: 1000 },
      'admin'
    );

    expect(fields.calculated_discount).toBe(1000);
    expect(fields.calculated_subtotal).toBe(80000);
  });

  it('honours an explicit IVA exemption', async () => {
    const fields = await OrderPricingService.priceNewOrder({ ...order1573, apply_iva: false }, 'admin');

    expect(fields.calculated_iva).toBe(0);
    expect(fields.calculated_total).toBe(96000);
  });

  it('rejects an order whose line items are not a list', async () => {
    await expect(
      OrderPricingService.priceNewOrder({ ...order1573, line_items: 'nope' }, 'admin')
    ).rejects.toBeInstanceOf(PricingError);
  });
});

describe('OrderPricingService.priceOrderUpdate', () => {
  it('drops an ineligible coupon to zero and names the order in the warning', async () => {
    getCouponByCode.mockResolvedValue({
      id: 7,
      code: 'DIEZ',
      status: 'publish',
      discount_type: 'percent',
      amount: 10,
      maximum_amount: null,
    });
    couponEligibility.mockResolvedValue({ eligible: false, reason: 'Este cupón ha expirado' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const fields = await OrderPricingService.priceOrderUpdate(
      { ...order1573, id: 1573, shipping_total: 0, customer_id: 42, calculated_iva: 1 },
      { coupon_lines: [{ code: 'DIEZ' }] }
    );

    expect(fields?.calculated_discount).toBe(0);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Cupón ignorado'),
      expect.objectContaining({ orderId: 1573, code: 'DIEZ' })
    );
    warn.mockRestore();
  });

  it('returns null when the update does not touch money', async () => {
    await expect(
      OrderPricingService.priceOrderUpdate({ ...order1573, calculated_iva: 18240 }, { status: 'completed' })
    ).resolves.toBeNull();
  });

  it('recomputes from the stored order merged with the update, including shipping', async () => {
    const current = { ...order1573, shipping_total: 0, calculated_iva: 15390, calculated_subtotal: 81000, calculated_discount: 0 };

    const fields = await OrderPricingService.priceOrderUpdate(current, {
      shipping_total: 15000,
      calculated_total: 1,
    });

    expect(fields).toEqual(expect.objectContaining({ shipping_total: 15000, calculated_total: 114240 }));
  });

  it('derives IVA exemption from the stored order when apply_iva is absent', async () => {
    const current = { ...order1573, calculated_iva: 0, calculated_subtotal: 96000, calculated_discount: 0 };

    const fields = await OrderPricingService.priceOrderUpdate(current, { order_fecha_termino: '2026-09-23' });

    expect(fields?.num_jornadas).toBe(4);
    expect(fields?.calculated_iva).toBe(0);
    expect(fields?.calculated_total).toBe(123000);
  });

  it('keeps charging IVA on an order that had nothing to tax yet', async () => {
    const current = { ...order1573, line_items: [], calculated_iva: 0, calculated_subtotal: 0, calculated_discount: 0 };

    const fields = await OrderPricingService.priceOrderUpdate(current, { line_items: order1573.line_items });

    expect(fields?.calculated_iva).toBe(18240);
  });

  it('uses an explicit apply_iva over the stored order', async () => {
    const current = { ...order1573, calculated_iva: 18240, calculated_subtotal: 96000, calculated_discount: 0 };

    const fields = await OrderPricingService.priceOrderUpdate(current, { apply_iva: false });

    expect(fields?.calculated_total).toBe(96000);
  });

  it('keeps the stored manual discount when the update does not send one', async () => {
    const current = { ...order1573, calculated_iva: 1, calculated_subtotal: 91000, calculated_discount: 5000 };

    const fields = await OrderPricingService.priceOrderUpdate(current, { shipping_total: 15000 });

    expect(fields?.calculated_discount).toBe(5000);
    expect(fields?.calculated_subtotal).toBe(91000);
  });
});
