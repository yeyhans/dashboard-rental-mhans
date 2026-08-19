import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * T-014a. Before this route existed the admin chat read `order_communications` straight from
 * PostgREST in the browser with a bare anon key and no JWT. Migration 0001 enables RLS on that
 * table and drops the residual `allow_all_for_testing` policy, so that path returns zero rows
 * silently. These tests pin the replacement: an admin-gated route on top of the service role.
 *
 * Supabase is mocked at `createClient`, so `withAuth` -> `getServerAdmin` runs for real.
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

const listByOrder = vi.fn();
const create = vi.fn();

vi.mock('../../../../../services/communicationsDataService', () => ({
  CommunicationsDataService: { listByOrder, create },
}));

function stubAdminLookup(result: { data: unknown; error: unknown }) {
  adminFrom.mockReturnValue({
    select: () => ({
      eq: () => ({
        in: () => ({ single: () => Promise.resolve(result) }),
      }),
    }),
  });
}

function asAdmin() {
  authGetUser.mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@x.cl' } }, error: null });
  stubAdminLookup({ data: { id: 1, user_id: 'admin-1', email: 'admin@x.cl', role: 'admin' }, error: null });
}

function context(options: { orderId?: string; cookie?: string; search?: string; body?: unknown } = {}) {
  const { orderId = '42', cookie, search = '', body } = options;
  const href = `https://dashboard.mariohans.cl/api/communications/order/${orderId}${search}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.cookie = cookie;

  return {
    params: { orderId },
    url: new URL(href),
    request: new Request(href, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  };
}

const sampleMessage = {
  id: 7,
  order_id: 42,
  user_id: 'admin-1',
  user_type: 'admin',
  message: 'Equipo listo para retiro',
  message_type: 'text',
  file_url: null,
  file_name: null,
  is_read: false,
  user_name: 'Mario',
  user_email: 'admin@x.cl',
  created_at: '2026-08-18T10:00:00.000Z',
  updated_at: '2026-08-18T10:00:00.000Z',
};

describe('GET /api/communications/order/[orderId]', () => {
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

  it('rejects an unauthenticated request without reading the thread', async () => {
    const { GET } = await import('../[orderId]');

    const response = await GET(context() as never);

    expect(response.status).toBe(401);
    expect(listByOrder).not.toHaveBeenCalled();
  });

  it('rejects a valid session that is not in admin_users', async () => {
    authGetUser.mockResolvedValue({ data: { user: { id: 'u-1', email: 'cliente@x.cl' } }, error: null });
    stubAdminLookup({ data: null, error: { code: 'PGRST116' } });
    const { GET } = await import('../[orderId]');

    const response = await GET(context({ cookie: 'sb-access-token=valid-jwt' }) as never);

    expect(response.status).toBe(401);
    expect(listByOrder).not.toHaveBeenCalled();
  });

  it('returns the thread for an authenticated admin', async () => {
    asAdmin();
    listByOrder.mockResolvedValue({ messages: [sampleMessage], total: 1 });
    const { GET } = await import('../[orderId]');

    const response = await GET(context({ cookie: 'sb-access-token=valid-jwt' }) as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.messages).toHaveLength(1);
    expect(payload.data.total).toBe(1);
    expect(listByOrder).toHaveBeenCalledWith(42, {});
  });

  it('forwards search and pagination parameters to the data layer', async () => {
    asAdmin();
    listByOrder.mockResolvedValue({ messages: [], total: 0 });
    const { GET } = await import('../[orderId]');

    const response = await GET(
      context({ cookie: 'sb-access-token=valid-jwt', search: '?search=retiro&page=2&limit=10' }) as never
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listByOrder).toHaveBeenCalledWith(42, { search: 'retiro', page: 2, limit: 10 });
    expect(payload.data.page).toBe(2);
    expect(payload.data.hasMore).toBe(false);
  });

  it('rejects a non-numeric order id', async () => {
    asAdmin();
    const { GET } = await import('../[orderId]');

    const response = await GET(context({ orderId: 'abc', cookie: 'sb-access-token=valid-jwt' }) as never);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('ID de orden inválido');
    expect(listByOrder).not.toHaveBeenCalled();
  });
});

describe('POST /api/communications/order/[orderId]', () => {
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

  it('rejects an unauthenticated send without writing anything', async () => {
    const { POST } = await import('../[orderId]');

    const response = await POST(
      context({ body: { userId: 'admin-1', userType: 'admin', message: 'hola' } }) as never
    );

    expect(response.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it('persists a message for an authenticated admin', async () => {
    asAdmin();
    create.mockResolvedValue(sampleMessage);
    const { POST } = await import('../[orderId]');

    const response = await POST(
      context({
        cookie: 'sb-access-token=valid-jwt',
        body: {
          userId: 'admin-1',
          userType: 'admin',
          message: 'Equipo listo para retiro',
          userName: 'Mario',
          userEmail: 'admin@x.cl',
        },
      }) as never
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.data.id).toBe(7);
    expect(create).toHaveBeenCalledWith({
      orderId: 42,
      userId: 'admin-1',
      userType: 'admin',
      message: 'Equipo listo para retiro',
      messageType: 'text',
      fileUrl: undefined,
      fileName: undefined,
      userName: 'Mario',
      userEmail: 'admin@x.cl',
    });
  });

  it('rejects an empty message', async () => {
    asAdmin();
    const { POST } = await import('../[orderId]');

    const response = await POST(
      context({ cookie: 'sb-access-token=valid-jwt', body: { userId: 'admin-1', userType: 'admin', message: '   ' } }) as never
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('El mensaje no puede estar vacío');
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a message_type outside the DB check constraint', async () => {
    asAdmin();
    const { POST } = await import('../[orderId]');

    const response = await POST(
      context({
        cookie: 'sb-access-token=valid-jwt',
        body: { userId: 'admin-1', userType: 'admin', message: 'hola', messageType: 'video' },
      }) as never
    );

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a user_type outside the DB check constraint', async () => {
    asAdmin();
    const { POST } = await import('../[orderId]');

    const response = await POST(
      context({
        cookie: 'sb-access-token=valid-jwt',
        body: { userId: 'admin-1', userType: 'robot', message: 'hola' },
      }) as never
    );

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});
