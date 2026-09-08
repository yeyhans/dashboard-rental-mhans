import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** T-014a: `markMessagesAsRead` was an anon UPDATE, revoked by migration 0001. */
const authGetUser = vi.fn();
const refreshSession = vi.fn();
const adminFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: authGetUser, refreshSession },
    from: adminFrom,
  }),
}));

const markThreadAsRead = vi.fn();

vi.mock('../../../../../../services/communicationsDataService', () => ({
  CommunicationsDataService: { markThreadAsRead },
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

function context(options: { cookie?: string; body?: unknown; orderId?: string } = {}) {
  const { cookie, body = {}, orderId = '42' } = options;
  const href = `https://dashboard.mariohans.cl/api/communications/order/${orderId}/mark-read`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.cookie = cookie;

  return {
    params: { orderId },
    url: new URL(href),
    request: new Request(href, { method: 'POST', headers, body: JSON.stringify(body) }),
  };
}

describe('POST /api/communications/order/[orderId]/mark-read', () => {
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

  it('rejects an unauthenticated request without touching the table', async () => {
    const { POST } = await import('../mark-read');

    const response = await POST(context({ body: { userId: 'admin-1' } }) as never);

    expect(response.status).toBe(401);
    expect(markThreadAsRead).not.toHaveBeenCalled();
  });

  it('marks the other party messages as read for an authenticated admin', async () => {
    asAdmin();
    markThreadAsRead.mockResolvedValue(2);
    const { POST } = await import('../mark-read');

    const response = await POST(context({ cookie: 'sb-access-token=valid-jwt', body: { userId: 'admin-1' } }) as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.updated).toBe(2);
    expect(markThreadAsRead).toHaveBeenCalledWith(42, 'admin-1');
  });

  it('requires a userId', async () => {
    asAdmin();
    const { POST } = await import('../mark-read');

    const response = await POST(context({ cookie: 'sb-access-token=valid-jwt', body: {} }) as never);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('userId es requerido');
    expect(markThreadAsRead).not.toHaveBeenCalled();
  });
});
