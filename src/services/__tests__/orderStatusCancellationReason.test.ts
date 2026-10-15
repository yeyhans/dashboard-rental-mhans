import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `OrderService.updateOrderStatus` stores the admin's cancel reason in `orders.cancellation_reason`
 * (migration 0003) — never in `customer_note`, which belongs to the customer.
 */
const from = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());

vi.mock('../../lib/supabase', () => ({
  supabaseAdmin: { from },
}));

vi.mock('../couponService', () => ({
  CouponService: {
    syncOrderCouponUsage: vi.fn(async () => undefined),
    releaseOrderCouponUsage: vi.fn(async () => undefined),
  },
}));

vi.mock('../orderPricingService', () => ({
  OrderPricingService: {
    priceNewOrder: vi.fn(async () => null),
    priceOrderUpdate: vi.fn(async () => null),
  },
}));

const { OrderService } = await import('../orderService');

beforeEach(() => {
  from.mockReset();
  update.mockReset();
  const single = vi.fn(async () => ({
    data: { id: 9, status: 'cancelled', line_items: [] },
    error: null,
  }));
  update.mockImplementation(() => ({
    eq: vi.fn(() => ({ select: vi.fn(() => ({ single })) })),
  }));
  from.mockReturnValue({ update });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('OrderService.updateOrderStatus — cancellation reason', () => {
  it('writes the reason to cancellation_reason', async () => {
    await OrderService.updateOrderStatus(9, 'cancelled', undefined, {
      cancellationReason: 'Cliente desistió',
    });

    const payload = update.mock.calls[0]![0];
    expect(payload).toMatchObject({
      status: 'cancelled',
      cancellation_reason: 'Cliente desistió',
    });
    expect(payload).not.toHaveProperty('customer_note');
  });

  it('leaves cancellation_reason untouched without a reason', async () => {
    await OrderService.updateOrderStatus(9, 'cancelled');

    expect(update.mock.calls[0]![0]).not.toHaveProperty('cancellation_reason');
  });
});
