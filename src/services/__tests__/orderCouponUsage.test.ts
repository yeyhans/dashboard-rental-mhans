import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Where the coupon usage lifecycle is wired in.
 *
 * It hangs off `OrderService`, not off the routes, for the same reason the money does: there are
 * four ways into an order write — `POST /api/orders` (admin panel and, with the frontend API key,
 * the customer site), `PUT /api/orders/[id]`, `PUT /api/orders/update/[id]` and
 * `PUT /api/orders/[id]/status` (plus its `/api/orders/status/[id]` alias) — and every one of
 * them goes through these three service methods. Wiring the routes instead would mean five copies
 * of the rule and five chances for the next route to forget it.
 *
 * The recording is deliberately *after* the row exists and can never undo it: an order is revenue,
 * a missing `coupon_usage` row is a reconciliation chore.
 */
const from = vi.hoisted(() => vi.fn());
const syncOrderCouponUsage = vi.hoisted(() => vi.fn());
const releaseOrderCouponUsage = vi.hoisted(() => vi.fn());
const priceNewOrder = vi.hoisted(() => vi.fn());
const priceOrderUpdate = vi.hoisted(() => vi.fn());

vi.mock('../../lib/supabase', () => ({
  supabaseAdmin: { from },
}));

vi.mock('../couponService', () => ({
  CouponService: { syncOrderCouponUsage, releaseOrderCouponUsage },
}));

vi.mock('../orderPricingService', () => ({
  OrderPricingService: { priceNewOrder, priceOrderUpdate },
}));

const { OrderService } = await import('../orderService');

const PRICED = {
  num_jornadas: 3,
  shipping_total: 0,
  calculated_subtotal: 81000,
  calculated_discount: 9000,
  calculated_iva: 15390,
  calculated_total: 96390,
  total: 96390,
};

function storedOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 501,
    customer_id: 42,
    coupon_lines: [{ code: 'DIEZ' }],
    status: 'request',
    ...PRICED,
    ...overrides,
  };
}

/** `from('orders').insert([...]).select().single()` and the update/eq/select/single chain. */
function stubOrdersTable(row: Record<string, unknown>) {
  const single = vi.fn(async () => ({ data: row, error: null }));
  const select = vi.fn(() => ({ single }));
  from.mockReturnValue({
    insert: vi.fn(() => ({ select })),
    update: vi.fn(() => ({ eq: vi.fn(() => ({ select })) })),
  });
}

beforeEach(() => {
  from.mockReset();
  syncOrderCouponUsage.mockReset().mockResolvedValue(undefined);
  releaseOrderCouponUsage.mockReset().mockResolvedValue(undefined);
  priceNewOrder.mockReset().mockResolvedValue(PRICED);
  priceOrderUpdate.mockReset().mockResolvedValue(null);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OrderService.createOrder records the coupon usage', () => {
  it.each(['admin', 'frontend'] as const)('records it for a %s caller', async (origin) => {
    stubOrdersTable(storedOrder());

    await OrderService.createOrder({ customer_id: 42 } as never, origin);

    expect(syncOrderCouponUsage).toHaveBeenCalledTimes(1);
    expect(syncOrderCouponUsage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 501, customer_id: 42 }),
      { isNew: true }
    );
  });

  it('passes the order as persisted, not as the client sent it', async () => {
    stubOrdersTable(storedOrder({ coupon_lines: [{ code: 'DIEZ' }] }));

    await OrderService.createOrder(
      { customer_id: 42, coupon_lines: [{ code: 'OTRO' }] } as never,
      'frontend'
    );

    expect(syncOrderCouponUsage).toHaveBeenCalledWith(
      expect.objectContaining({ coupon_lines: [{ code: 'DIEZ' }] }),
      { isNew: true }
    );
  });

  it('still returns the created order when the recording blows up', async () => {
    stubOrdersTable(storedOrder());
    syncOrderCouponUsage.mockRejectedValue(new Error('rpc unavailable'));

    const order = await OrderService.createOrder({ customer_id: 42 } as never, 'admin');

    expect(order.id).toBe(501);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[OrderService]'),
      expect.objectContaining({ orderId: 501 })
    );
  });
});

describe('OrderService.updateOrderStatus releases on cancellation', () => {
  it('releases the usage when the order is cancelled', async () => {
    stubOrdersTable(storedOrder({ status: 'cancelled' }));

    await OrderService.updateOrderStatus(501, 'cancelled');

    expect(releaseOrderCouponUsage).toHaveBeenCalledWith(501);
  });

  it('is a no-op on a second cancellation of the same order', async () => {
    stubOrdersTable(storedOrder({ status: 'cancelled' }));

    await OrderService.updateOrderStatus(501, 'cancelled');
    await OrderService.updateOrderStatus(501, 'cancelled');

    // Both calls reach the same idempotent database function; nothing here needs to remember.
    expect(releaseOrderCouponUsage).toHaveBeenCalledTimes(2);
    expect(releaseOrderCouponUsage).toHaveBeenNthCalledWith(2, 501);
  });

  it('releases nothing on any other status', async () => {
    stubOrdersTable(storedOrder({ status: 'confirmed' }));

    await OrderService.updateOrderStatus(501, 'confirmed');

    expect(releaseOrderCouponUsage).not.toHaveBeenCalled();
  });

  it('still returns the order when the release fails', async () => {
    stubOrdersTable(storedOrder({ status: 'cancelled' }));
    releaseOrderCouponUsage.mockRejectedValue(new Error('rpc unavailable'));

    const order = await OrderService.updateOrderStatus(501, 'cancelled');

    expect(order.id).toBe(501);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[OrderService]'),
      expect.objectContaining({ orderId: 501 })
    );
  });
});

describe('OrderService.updateOrder follows the edited coupon', () => {
  it('re-syncs when the edit touched the coupon', async () => {
    stubOrdersTable(storedOrder({ coupon_lines: [{ code: 'VERANO' }] }));

    await OrderService.updateOrder(501, { coupon_lines: [{ code: 'VERANO' }] } as never);

    expect(syncOrderCouponUsage).toHaveBeenCalledWith(
      expect.objectContaining({ coupon_lines: [{ code: 'VERANO' }] }),
      undefined
    );
  });

  it('re-syncs when the edit changed the status', async () => {
    stubOrdersTable(storedOrder({ status: 'cancelled' }));

    await OrderService.updateOrder(501, { status: 'cancelled' } as never);

    expect(syncOrderCouponUsage).toHaveBeenCalledTimes(1);
  });

  it('leaves the usage alone for an edit that touches neither', async () => {
    stubOrdersTable(storedOrder());

    await OrderService.updateOrder(501, { order_comments: 'retira a las 18:00' } as never);

    expect(syncOrderCouponUsage).not.toHaveBeenCalled();
  });

  it('still returns the updated order when the re-sync fails', async () => {
    stubOrdersTable(storedOrder({ coupon_lines: [] }));
    syncOrderCouponUsage.mockRejectedValue(new Error('rpc unavailable'));

    const order = await OrderService.updateOrder(501, { coupon_lines: [] } as never);

    expect(order.id).toBe(501);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[OrderService]'),
      expect.objectContaining({ orderId: 501 })
    );
  });
});
