import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * T-014b. `POST /api/orders/[id]/email` read the order and flipped `correo_enviado` through the
 * JWT-less anon client with no `withAuth`. Its embedded `user_profiles(*)` join was already
 * returning null in production because that table has RLS and no anon policy — moving to
 * `OrderService` (service role) restores the customer block the template needs.
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

const getOrderById = vi.fn();
const updateOrder = vi.fn();

vi.mock('../../../../../services/orderService', () => ({
  OrderService: { getOrderById, updateOrder },
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
  const href = `https://dashboard.mariohans.cl/api/orders/${id}/email`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.cookie = cookie;

  return {
    params: { id },
    url: new URL(href),
    request: new Request(href, { method: 'POST', headers, body: JSON.stringify(body) }),
  };
}

const orderWithProfile = {
  id: 123,
  billing_email: 'cliente@x.cl',
  user_profiles: { user_id: 9, nombre: 'Ana', apellido: 'Pérez', email: 'cliente@x.cl' },
};

describe('POST /api/orders/[id]/email', () => {
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

  it('rejects an unauthenticated request without reading the order', async () => {
    const { POST } = await import('../email');

    const response = await POST(context({ body: { type: 'order_confirmation' } }) as never);

    expect(response.status).toBe(401);
    expect(getOrderById).not.toHaveBeenCalled();
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it('returns the order with its customer profile resolved and flags the email as sent', async () => {
    asAdmin();
    getOrderById.mockResolvedValue(orderWithProfile);
    updateOrder.mockResolvedValue({ ...orderWithProfile, correo_enviado: true });
    const { POST } = await import('../email');

    const response = await POST(
      context({ cookie: 'sb-access-token=valid-jwt', body: { type: 'order_confirmation' } }) as never
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.emailData.data.order.user_profiles.nombre).toBe('Ana');
    expect(updateOrder).toHaveBeenCalledWith(
      123,
      expect.objectContaining({ correo_enviado: true, date_modified: expect.any(String) })
    );
  });

  it('returns 404 when the order does not exist', async () => {
    asAdmin();
    getOrderById.mockResolvedValue(null);
    const { POST } = await import('../email');

    const response = await POST(
      context({ cookie: 'sb-access-token=valid-jwt', body: { type: 'order_confirmation' } }) as never
    );

    expect(response.status).toBe(404);
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it('rejects an unknown email type', async () => {
    asAdmin();
    const { POST } = await import('../email');

    const response = await POST(context({ cookie: 'sb-access-token=valid-jwt', body: { type: 'spam' } }) as never);

    expect(response.status).toBe(400);
    expect(getOrderById).not.toHaveBeenCalled();
  });
});
