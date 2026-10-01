import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * T-019. `PUT /api/orders/status/[id]` is a SECOND route writing `orders.status`, on a different
 * URL shape from `PUT /api/orders/[id]/status`. Both are admin-gated, but only the latter was
 * hardened, so this one remained a back door:
 *
 *  · Its allowlist was the seven LEGACY values. After migration 0003 five of them are rejected by
 *    `orders_status_check`, and none of the eight new ones was accepted — so post-cutover the
 *    route is either a 500 or a 400 for every possible input.
 *  · It had no state machine, so it could move an order straight from `request` to `completed`,
 *    skipping the serial-number assignment that `preparation` exists to record.
 *  · It forwarded `notes` into `OrderService.updateOrderStatus`, whose third parameter writes
 *    `customer_note` — an admin note overwriting text that belongs to the customer.
 *
 * The fix is not a second copy of the rules. This route now delegates to the same handler, so the
 * two URLs cannot drift apart again. These tests assert the behaviour through THIS route's module,
 * which is what proves the delegation is wired, not merely intended.
 */
const authGetUser = vi.fn();
const refreshSession = vi.fn();
const adminFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: authGetUser, refreshSession },
    from: adminFrom,
  }),
}));

const updateOrderStatus = vi.fn();
const getOrderById = vi.fn();

vi.mock('../../../../../services/orderService', () => ({
  OrderService: { updateOrderStatus, getOrderById },
}));

function asAdmin() {
  authGetUser.mockResolvedValue({
    data: { user: { id: 'admin-1', email: 'admin@x.cl' } },
    error: null,
  });
  adminFrom.mockReturnValue({
    select: () => ({
      eq: () => ({
        in: () => ({
          single: () =>
            Promise.resolve({
              data: { id: 1, user_id: 'admin-1', email: 'admin@x.cl', role: 'admin' },
              error: null,
            }),
        }),
      }),
    }),
  });
}

function context(body: unknown, id = '123') {
  const href = `https://dashboard.mariohans.cl/api/orders/status/${id}`;
  return {
    params: { id },
    url: new URL(href),
    request: new Request(href, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: 'sb-access-token=valid-jwt' },
      body: JSON.stringify(body),
    }),
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
  refreshSession.mockResolvedValue({ data: {}, error: { message: 'Invalid Refresh Token' } });
  getOrderById.mockResolvedValue({ id: 123, status: 'evaluation' });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('PUT /api/orders/status/[id]', () => {
  it('rejects an unauthenticated caller', async () => {
    const { PUT } = await import('../[id]');
    const href = 'https://dashboard.mariohans.cl/api/orders/status/123';

    const response = await PUT({
      params: { id: '123' },
      url: new URL(href),
      request: new Request(href, { method: 'PUT', body: JSON.stringify({ status: 'confirmed' }) }),
    } as never);

    expect(response.status).toBe(401);
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it.each(['on-hold', 'processing', 'pending', 'refunded', 'failed'])(
    'rejects the legacy status %s that its own allowlist used to accept',
    async (legacy) => {
      asAdmin();
      const { PUT } = await import('../[id]');

      const response = await PUT(context({ status: legacy }) as never);

      expect(response.status).toBe(400);
      expect(updateOrderStatus).not.toHaveBeenCalled();
    }
  );

  it('accepts a legal v1.2 advance', async () => {
    asAdmin();
    updateOrderStatus.mockResolvedValue({ id: 123, status: 'confirmed' });
    const { PUT } = await import('../[id]');

    const response = await PUT(context({ status: 'confirmed' }) as never);

    expect(response.status).toBe(200);
    expect(updateOrderStatus).toHaveBeenCalledWith(123, 'confirmed');
  });

  it('enforces the state machine on this URL too, not just the other one', async () => {
    asAdmin();
    getOrderById.mockResolvedValue({ id: 123, status: 'request' });
    const { PUT } = await import('../[id]');

    const response = await PUT(context({ status: 'completed' }) as never);

    expect(response.status).toBe(409);
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it('never forwards notes into the customer note field', async () => {
    // `OrderService.updateOrderStatus(id, status, notes)` writes its third argument to
    // `orders.customer_note`. That column is the CUSTOMER's message about their own order; an
    // admin status note landing there silently destroys it.
    asAdmin();
    updateOrderStatus.mockResolvedValue({ id: 123, status: 'confirmed' });
    const { PUT } = await import('../[id]');

    await PUT(context({ status: 'confirmed', notes: 'nota interna del admin' }) as never);

    expect(updateOrderStatus).toHaveBeenCalledWith(123, 'confirmed');
  });

  it('rejects a non-numeric id', async () => {
    asAdmin();
    const { PUT } = await import('../[id]');

    const response = await PUT(context({ status: 'confirmed' }, 'abc') as never);

    expect(response.status).toBe(400);
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });
});
