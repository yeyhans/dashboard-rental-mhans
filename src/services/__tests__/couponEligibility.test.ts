import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `CouponService.couponEligibility` is the single server-side answer to "may this order use this
 * coupon?". It existed only inside `validateCouponManual`, which the checkout called and the
 * order pricing did not — so a POST straight to `/api/orders` with an expired or exhausted code
 * still got its discount computed and persisted.
 */
const from = vi.hoisted(() => vi.fn());

vi.mock('../../lib/supabase', () => ({
  supabaseAdmin: { from },
}));

const { CouponService } = await import('../couponService');

const publishedCoupon = {
  id: 7,
  code: 'DIEZ',
  status: 'publish',
  discount_type: 'percent',
  amount: 10,
  date_expires: null as string | null,
  usage_count: 0,
  usage_limit: null as number | null,
  usage_limit_per_user: null as number | null,
  minimum_amount: null as number | null,
  maximum_amount: null as number | null,
};

/** `coupon_usage` count for the user asking. */
function stubUserUsage(count: number) {
  from.mockReturnValue({
    select: () => ({
      eq: () => ({
        eq: async () => ({ count, error: null }),
      }),
    }),
  });
}

beforeEach(() => {
  from.mockReset();
  stubUserUsage(0);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('CouponService.couponEligibility', () => {
  it('accepts a published coupon with no limits', async () => {
    await expect(CouponService.couponEligibility(publishedCoupon as never, 42, 81000)).resolves.toEqual({
      eligible: true,
      reason: null,
    });
  });

  it('rejects a coupon that is not published', async () => {
    const result = await CouponService.couponEligibility(
      { ...publishedCoupon, status: 'draft' } as never,
      42,
      81000
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('Cupón no disponible');
  });

  it('rejects an expired coupon', async () => {
    const result = await CouponService.couponEligibility(
      { ...publishedCoupon, date_expires: '2020-01-01T00:00:00Z' } as never,
      42,
      81000
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('Este cupón ha expirado');
  });

  it('rejects a coupon whose total usage limit is spent', async () => {
    const result = await CouponService.couponEligibility(
      { ...publishedCoupon, usage_limit: 5, usage_count: 5 } as never,
      42,
      81000
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('Este cupón ha alcanzado su límite de uso');
  });

  it('rejects a coupon this customer already used up', async () => {
    stubUserUsage(1);

    const result = await CouponService.couponEligibility(
      { ...publishedCoupon, usage_limit_per_user: 1 } as never,
      42,
      81000
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('Ya has utilizado este cupón anteriormente');
  });

  it('rejects an order below the coupon minimum', async () => {
    const result = await CouponService.couponEligibility(
      { ...publishedCoupon, minimum_amount: 100000 } as never,
      42,
      81000
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('monto mínimo');
  });

  it('skips the per-customer limit when the order has no customer yet', async () => {
    const result = await CouponService.couponEligibility(
      { ...publishedCoupon, usage_limit_per_user: 1 } as never,
      null,
      81000
    );

    expect(result).toEqual({ eligible: true, reason: null });
    expect(from).not.toHaveBeenCalled();
  });
});
