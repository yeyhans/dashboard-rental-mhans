import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Recording and releasing `coupon_usage` for an order.
 *
 * Until this lifecycle existed, `CouponService.applyCoupon` was reachable only from
 * `POST /api/coupons/apply/[code]`, so a coupon attached to a real order never incremented
 * `coupons.usage_count` and never produced a `coupon_usage` row. `usage_limit` and
 * `usage_limit_per_user` were therefore decorative: a single-use coupon could be spent forever.
 *
 * Both limits are enforced inside the database function (migration 0013), under a row lock on the
 * coupon, so two orders created at the same instant cannot both slip past a one-use limit. Vitest
 * has no database, so the tests here assert the boundary: which RPC is called, with which
 * arguments, and that a refusal or an outright failure is logged and swallowed — never thrown at
 * the caller, because the order row already exists by then.
 */
const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());

vi.mock('../../lib/supabase', () => ({
  supabaseAdmin: { rpc, from },
}));

const { CouponService } = await import('../couponService');

type OrderOverrides = Record<string, unknown>;

function storedOrder(overrides: OrderOverrides = {}) {
  return {
    id: 501,
    customer_id: 42,
    coupon_lines: [{ code: 'DIEZ', discount: 9000 }],
    calculated_discount: 9000,
    status: 'request',
    ...overrides,
  };
}

function rpcReturns(payload: Record<string, unknown>) {
  rpc.mockResolvedValue({ data: [payload], error: null });
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
  rpcReturns({ success: true, message: 'Uso del cupón registrado', usage_id: 1 });
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CouponService.syncOrderCouponUsage — recording on create', () => {
  it('records the usage through the guarded database function', async () => {
    await CouponService.syncOrderCouponUsage(storedOrder() as never, { isNew: true });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('record_coupon_usage_for_order', {
      p_order_id: 501,
      p_coupon_code: 'DIEZ',
      p_user_id: 42,
      p_discount_amount: 9000,
    });
  });

  it('reads the code from a coupon_lines column stored as JSON text', async () => {
    await CouponService.syncOrderCouponUsage(
      storedOrder({ coupon_lines: JSON.stringify([{ code: ' VERANO ' }]) }) as never,
      { isNew: true }
    );

    expect(rpc).toHaveBeenCalledWith(
      'record_coupon_usage_for_order',
      expect.objectContaining({ p_coupon_code: 'VERANO' })
    );
  });

  it('does nothing at all for an order with no coupon', async () => {
    await CouponService.syncOrderCouponUsage(
      storedOrder({ coupon_lines: [], calculated_discount: 0 }) as never,
      { isNew: true }
    );

    expect(rpc).not.toHaveBeenCalled();
  });

  it('does nothing for a new order that has no customer yet', async () => {
    await CouponService.syncOrderCouponUsage(storedOrder({ customer_id: null }) as never, {
      isNew: true,
    });

    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('CouponService.syncOrderCouponUsage — failure never loses the order', () => {
  it('logs and resolves when the RPC itself errors', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'function does not exist' } });

    await expect(
      CouponService.syncOrderCouponUsage(storedOrder() as never, { isNew: true })
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[CouponService]'),
      expect.objectContaining({ orderId: 501, code: 'DIEZ' })
    );
  });

  it('logs and resolves when the RPC call throws', async () => {
    rpc.mockRejectedValue(new Error('network down'));

    await expect(
      CouponService.syncOrderCouponUsage(storedOrder() as never, { isNew: true })
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[CouponService]'),
      expect.objectContaining({ orderId: 501, code: 'DIEZ' })
    );
  });

  it('logs the refusal when a second order would exceed the coupon usage_limit', async () => {
    // The limit is checked inside the function, under `SELECT ... FOR UPDATE` on the coupon row,
    // so this refusal is the same answer two concurrent orders would get — only one wins.
    rpcReturns({
      success: false,
      message: 'Este cupón ha alcanzado su límite de uso',
      usage_id: null,
    });

    await expect(
      CouponService.syncOrderCouponUsage(storedOrder({ id: 502 }) as never, { isNew: true })
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[CouponService]'),
      expect.objectContaining({
        orderId: 502,
        code: 'DIEZ',
        message: 'Este cupón ha alcanzado su límite de uso',
      })
    );
  });
});

describe('CouponService.releaseOrderCouponUsage — cancellation', () => {
  beforeEach(() => {
    rpcReturns({ released: 1 });
  });

  it('releases the usage recorded for the order', async () => {
    await CouponService.releaseOrderCouponUsage(501);

    expect(rpc).toHaveBeenCalledWith('release_coupon_usage_for_order', { p_order_id: 501 });
  });

  it('is a no-op the second time — the database function releases nothing', async () => {
    await CouponService.releaseOrderCouponUsage(501);
    rpcReturns({ released: 0 });
    await expect(CouponService.releaseOrderCouponUsage(501)).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs and resolves when the release fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'deadlock detected' } });

    await expect(CouponService.releaseOrderCouponUsage(501)).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[CouponService]'),
      expect.objectContaining({ orderId: 501 })
    );
  });

  it('ignores an invalid order id instead of calling the database', async () => {
    await CouponService.releaseOrderCouponUsage(Number.NaN);

    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('CouponService.syncOrderCouponUsage — the order changed after creation', () => {
  it('releases the usage when the order is cancelled', async () => {
    rpcReturns({ released: 1 });

    await CouponService.syncOrderCouponUsage(storedOrder({ status: 'cancelled' }) as never);

    expect(rpc).toHaveBeenCalledWith('release_coupon_usage_for_order', { p_order_id: 501 });
  });

  it('releases on the legacy `failed` status, which is the same terminal stage', async () => {
    rpcReturns({ released: 1 });

    await CouponService.syncOrderCouponUsage(storedOrder({ status: 'failed' }) as never);

    expect(rpc).toHaveBeenCalledWith('release_coupon_usage_for_order', { p_order_id: 501 });
  });

  it('releases when an edit removed the coupon', async () => {
    rpcReturns({ released: 1 });

    await CouponService.syncOrderCouponUsage(storedOrder({ coupon_lines: [] }) as never);

    expect(rpc).toHaveBeenCalledWith('release_coupon_usage_for_order', { p_order_id: 501 });
  });

  it('records the new code when an edit swapped the coupon — the old row goes with it', async () => {
    await CouponService.syncOrderCouponUsage(
      storedOrder({ coupon_lines: [{ code: 'VERANO' }], calculated_discount: 12000 }) as never
    );

    // One call, not two: the function drops whatever this order had recorded before and inserts
    // the new usage inside the same transaction, so a swap can never leave both rows behind.
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('record_coupon_usage_for_order', {
      p_order_id: 501,
      p_coupon_code: 'VERANO',
      p_user_id: 42,
      p_discount_amount: 12000,
    });
  });

  it('does not release on any other status change', async () => {
    await CouponService.syncOrderCouponUsage(storedOrder({ status: 'in-rental' }) as never);

    expect(rpc).not.toHaveBeenCalledWith(
      'release_coupon_usage_for_order',
      expect.anything()
    );
  });
});
