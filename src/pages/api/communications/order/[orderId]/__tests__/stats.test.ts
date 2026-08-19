import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** T-014a: stats used to be three anon PostgREST round-trips from the browser. */
const authGetUser = vi.fn();
const refreshSession = vi.fn();
const adminFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: authGetUser, refreshSession },
    from: adminFrom,
  }),
}));

const getStats = vi.fn();
const getAdvancedStats = vi.fn();

vi.mock('../../../../../../services/communicationsDataService', () => ({
  CommunicationsDataService: { getStats, getAdvancedStats },
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

function context(options: { cookie?: string; search?: string; orderId?: string } = {}) {
  const { cookie, search = '', orderId = '42' } = options;
  const href = `https://dashboard.mariohans.cl/api/communications/order/${orderId}/stats${search}`;
  return {
    params: { orderId },
    url: new URL(href),
    request: new Request(href, { method: 'GET', ...(cookie ? { headers: { cookie } } : {}) }),
  };
}

const basicStats = { total_messages: 3, unread_messages: 1, last_message_at: '2026-08-18T10:00:00.000Z' };

describe('GET /api/communications/order/[orderId]/stats', () => {
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

  it('rejects an unauthenticated request', async () => {
    const { GET } = await import('../stats');

    const response = await GET(context() as never);

    expect(response.status).toBe(401);
    expect(getStats).not.toHaveBeenCalled();
  });

  it('returns basic stats scoped to the requesting user', async () => {
    asAdmin();
    getStats.mockResolvedValue(basicStats);
    const { GET } = await import('../stats');

    const response = await GET(context({ cookie: 'sb-access-token=valid-jwt', search: '?userId=admin-1' }) as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.unread_messages).toBe(1);
    expect(payload.data.advanced).toBeUndefined();
    expect(getStats).toHaveBeenCalledWith(42, 'admin-1');
    expect(getAdvancedStats).not.toHaveBeenCalled();
  });

  it('adds the advanced block only when asked for it', async () => {
    asAdmin();
    getStats.mockResolvedValue(basicStats);
    getAdvancedStats.mockResolvedValue({
      total_messages: 3,
      customer_messages: 1,
      admin_messages: 2,
      unread_messages: 1,
      messages_with_files: 0,
      last_message_at: '2026-08-18T10:00:00.000Z',
      first_message_at: '2026-08-17T10:00:00.000Z',
      average_response_time_hours: 2,
    });
    const { GET } = await import('../stats');

    const response = await GET(context({ cookie: 'sb-access-token=valid-jwt', search: '?advanced=true' }) as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.advanced.admin_messages).toBe(2);
    expect(getStats).toHaveBeenCalledWith(42, undefined);
  });

  it('rejects a non-numeric order id', async () => {
    asAdmin();
    const { GET } = await import('../stats');

    const response = await GET(context({ cookie: 'sb-access-token=valid-jwt', orderId: 'abc' }) as never);

    expect(response.status).toBe(400);
    expect(getStats).not.toHaveBeenCalled();
  });
});
