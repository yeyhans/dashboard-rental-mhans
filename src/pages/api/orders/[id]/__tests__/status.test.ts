import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * T-014b. `PUT /api/orders/[id]/status` wrote `orders.status` through the JWT-less anon client
 * and had no `withAuth` at all: any unauthenticated caller could move an order to `completed`.
 * Migration 0001 revokes anon UPDATE, so the route breaks anyway. It now runs behind the admin
 * gate on top of `OrderService` (service role).
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

vi.mock('../../../../../services/orderService', () => ({
  OrderService: { updateOrderStatus },
}));

function stubAdminLookup(result: { data: unknown; error: unknown }) {
  adminFrom.mockReturnValue({
    select: () => ({ eq: () => ({ in: () => ({ single: () => Promise.resolve(result) }) }) }),
  });
}

function asAdmin() {
  authGetUser.mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@x.cl' } }, error: null });
  stubAdminLookup({ data: { id: 1, user_id: 'admin-1', email: 'admin@x.cl', role: 'admin' }, error: null });
}

function context(options: { cookie?: string; body?: unknown; id?: string } = {}) {
  const { cookie, body = {}, id = '123' } = options;
  const href = `https://dashboard.mariohans.cl/api/orders/${id}/status`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.cookie = cookie;

  return {
    params: { id },
    url: new URL(href),
    request: new Request(href, { method: 'PUT', headers, body: JSON.stringify(body) }),
  };
}

describe('PUT /api/orders/[id]/status', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    refreshSession.mockResolvedValue({ data: {}, error: { message: 'Invalid Refresh Token' } });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('rejects an unauthenticated status change', async () => {
    const { PUT } = await import('../status');

    const response = await PUT(context({ body: { status: 'completed' } }) as never);

    expect(response.status).toBe(401);
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it('updates the status for an authenticated admin', async () => {
    asAdmin();
    updateOrderStatus.mockResolvedValue({ id: 123, status: 'processing' });
    const { PUT } = await import('../status');

    const response = await PUT(context({ cookie: 'sb-access-token=valid-jwt', body: { status: 'processing' } }) as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.status).toBe('processing');
    expect(updateOrderStatus).toHaveBeenCalledWith(123, 'processing');
  });

  /**
   * The old allowlist accepted `trash` and `auto-draft`, which the `orders_status_check`
   * constraint rejects — a guaranteed 500 rather than a 400.
   */
  it('rejects a status the DB check constraint does not allow', async () => {
    asAdmin();
    const { PUT } = await import('../status');

    const response = await PUT(context({ cookie: 'sb-access-token=valid-jwt', body: { status: 'trash' } }) as never);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('Estado inválido');
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric order id', async () => {
    asAdmin();
    const { PUT } = await import('../status');

    const response = await PUT(context({ cookie: 'sb-access-token=valid-jwt', id: 'abc', body: { status: 'processing' } }) as never);

    expect(response.status).toBe(400);
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it('requires a status field', async () => {
    asAdmin();
    const { PUT } = await import('../status');

    const response = await PUT(context({ cookie: 'sb-access-token=valid-jwt', body: {} }) as never);

    expect(response.status).toBe(400);
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });
});
