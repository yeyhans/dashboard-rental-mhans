import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Supabase is mocked at its own boundary — `createClient` — so the route's real
 * query chain runs against a tiny in-memory filter. This is what catches the
 * historic super_admin regression: a stubbed `.single()` that ignores the
 * filters would pass no matter what role the query asks for.
 */
const signInWithPassword = vi.fn();

// Fila que existe en admin_users. El test de regresión usa super_admin porque
// el bug histórico era un `.eq('role', 'admin')` que lo excluía.
let adminRows: Array<{ user_id: string; role: string; email: string; is_active?: boolean }> = [];

function queryBuilder() {
  let rows = [...adminRows];
  const builder = {
    select: () => builder,
    eq: (col: string, val: string) => {
      rows = rows.filter((r) => (r as unknown as Record<string, unknown>)[col] === val);
      return builder;
    },
    in: (col: string, vals: string[]) => {
      rows = rows.filter((r) => vals.includes(String((r as unknown as Record<string, unknown>)[col])));
      return builder;
    },
    single: async () =>
      rows.length === 1
        ? { data: rows[0], error: null }
        : { data: null, error: { code: 'PGRST116', message: 'no rows' } },
  };
  return builder;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { signInWithPassword },
    from: () => queryBuilder(),
  }),
}));

function loginRequest(email: string) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
    body: JSON.stringify({ email, password: 'secret-password' }),
  });
}

function contextFor(request: Request) {
  const cookies = new Map<string, { value: string }>();
  return {
    request,
    cookies: {
      set: vi.fn(),
      get: (name: string) => cookies.get(name),
      delete: vi.fn(),
    },
  } as never;
}

async function postLogin(email: string) {
  vi.resetModules();
  const { POST } = await import('../login');
  return POST(contextFor(loginRequest(email)));
}

beforeEach(() => {
  vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
  signInWithPassword.mockReset();
  signInWithPassword.mockResolvedValue({
    data: {
      user: { id: 'uid-1', email: 'admin@test.cl' },
      session: { access_token: 'at', refresh_token: 'rt', expires_in: 3600 },
    },
    error: null,
  });
});

describe('POST /api/auth/login — admin_users role gate', () => {
  it('accepts a super_admin (historic regression: .eq(role, admin) excluded them)', async () => {
    adminRows = [{ user_id: 'uid-1', role: 'super_admin', email: 'admin@test.cl' }];
    const res = await postLogin('admin@test.cl');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('accepts a plain admin', async () => {
    adminRows = [{ user_id: 'uid-1', role: 'admin', email: 'admin@test.cl' }];
    const res = await postLogin('admin@test.cl');
    expect(res.status).toBe(200);
  });

  it('rejects an authenticated user with no admin_users row', async () => {
    adminRows = [];
    const res = await postLogin('noadmin@test.cl');
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toMatch(/administrador/i);
  });

  // Batch 3 (0011): operators log in through the same door and are sent to the garage.
  it('accepts an operator and points the browser at /bodega', async () => {
    adminRows = [{ user_id: 'uid-1', role: 'operator', email: 'bodega@test.cl', is_active: true }];
    const res = await postLogin('bodega@test.cl');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.redirect_to).toBe('/bodega');
    expect(body.data.user.role).toBe('operator');
  });

  it('sends admins to /dashboard', async () => {
    adminRows = [{ user_id: 'uid-1', role: 'admin', email: 'admin@test.cl', is_active: true }];
    const res = await postLogin('admin@test.cl');
    const body = await res.json();
    expect(body.data.redirect_to).toBe('/dashboard');
  });

  it('rejects a deactivated account with its own message and sets no cookies', async () => {
    adminRows = [{ user_id: 'uid-1', role: 'operator', email: 'ex@test.cl', is_active: false }];
    vi.resetModules();
    const { POST } = await import('../login');
    const context = contextFor(loginRequest('ex@test.cl'));
    const res = await POST(context);
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toBe('Tu cuenta está desactivada');
    expect((context as { cookies: { set: ReturnType<typeof vi.fn> } }).cookies.set).not.toHaveBeenCalled();
  });

  it('treats a row without the flag (pre-0011 database) as active', async () => {
    adminRows = [{ user_id: 'uid-1', role: 'admin', email: 'admin@test.cl' }];
    const res = await postLogin('admin@test.cl');
    expect(res.status).toBe(200);
  });
});
