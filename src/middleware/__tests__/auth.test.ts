import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FORBIDDEN_ROLE_ERROR, INACTIVE_ACCOUNT_ERROR } from '../../lib/accessControl';

/**
 * `withAuth` / `requireRole` against the batch-3 session contract: a deactivated account gets
 * its own 401, and an `operator` is confined to the scan endpoints. The verdict itself comes from
 * `lib/accessControl.ts` (covered in `lib/__tests__/accessControl.test.ts`); this suite checks
 * that the middleware asks for it and turns it into the right HTTP answer.
 *
 * `resolveAdminSession` is mocked at the `lib/supabase` boundary — the session lookup has its own
 * suite and a real database behind it.
 */
const resolveAdminSession = vi.fn();

vi.mock('../../lib/supabase', () => ({
  resolveAdminSession: (...args: unknown[]) => resolveAdminSession(...args),
}));

const { requireRole, withAuth } = await import('../auth');

function session(role: string, adminId = 7) {
  return {
    session: {
      user: { id: 'auth-uid', email: 'x@test.cl' },
      admin: { id: adminId, user_id: 'auth-uid', email: 'x@test.cl', role, is_active: true, created_at: '' },
      expiresAt: new Date(),
      isExtended: true,
    },
    inactive: false,
  };
}

function contextFor(method: string, path: string) {
  return {
    request: new Request(`https://dash.test${path}`, { method }),
    url: new URL(`https://dash.test${path}`),
    cookies: { get: () => undefined, set: () => {}, delete: () => {} },
    locals: {},
  };
}

const ok = vi.fn(async () => new Response('ok', { status: 200 }));

beforeEach(() => {
  resolveAdminSession.mockReset();
  ok.mockClear();
});

describe('withAuth — session states', () => {
  it('401 with the generic message when there is no session', async () => {
    resolveAdminSession.mockResolvedValue({ session: null, inactive: false });
    const res = await withAuth(ok)(contextFor('GET', '/api/orders'));
    expect(res.status).toBe(401);
    expect(ok).not.toHaveBeenCalled();
  });

  it('401 with "Tu cuenta está desactivada" when the account is inactive', async () => {
    resolveAdminSession.mockResolvedValue({ session: null, inactive: true });
    const res = await withAuth(ok)(contextFor('POST', '/api/inventory/movements'));
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toEqual({ success: false, error: INACTIVE_ACCOUNT_ERROR });
    expect(ok).not.toHaveBeenCalled();
  });

  it('passes an admin through and exposes user + adminSession on the context', async () => {
    resolveAdminSession.mockResolvedValue(session('admin'));
    const context = contextFor('GET', '/api/orders');
    const res = await withAuth(ok)(context);
    expect(res.status).toBe(200);
    expect((context as { user?: { role: string } }).user?.role).toBe('admin');
    expect((context as { adminSession?: { admin: { id: number } } }).adminSession?.admin.id).toBe(7);
  });

  it('also exposes user + adminSession on locals — where the API routes read them from', async () => {
    resolveAdminSession.mockResolvedValue(session('operator', 12));
    const context = contextFor('POST', '/api/inventory/movements');
    await withAuth(ok)(context);
    const locals = context.locals as { user?: { id: string; role: string }; adminSession?: { admin: { id: number } } };
    expect(locals.user).toEqual({ id: 'auth-uid', email: 'x@test.cl', role: 'operator' });
    // The id that signs `asset_movements.checked_by_admin_id`.
    expect(locals.adminSession?.admin.id).toBe(12);
  });
});

describe('withAuth — operator gating', () => {
  beforeEach(() => {
    resolveAdminSession.mockResolvedValue(session('operator'));
  });

  it.each([
    ['GET', '/api/inventory/assets?tag=MH-00001'],
    ['POST', '/api/inventory/movements'],
    ['GET', '/api/bodega/board'],
    ['POST', '/api/auth/logout'],
  ])('%s %s → handler runs', async (method, path) => {
    const res = await withAuth(ok)(contextFor(method, path));
    expect(res.status).toBe(200);
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['GET', '/api/orders'],
    ['GET', '/api/inventory/movements'],
    ['POST', '/api/inventory/assets'],
    ['GET', '/api/operators'],
  ])('%s %s → 403 JSON, handler never runs', async (method, path) => {
    const res = await withAuth(ok)(contextFor(method, path));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body).toEqual({ success: false, error: FORBIDDEN_ROLE_ERROR });
    expect(ok).not.toHaveBeenCalled();
  });

  it('derives the path from request.url when the context has no url (manual callers)', async () => {
    const context = { ...contextFor('GET', '/api/orders'), url: undefined };
    const res = await withAuth(ok)(context);
    expect(res.status).toBe(403);
  });
});

describe('requireRole', () => {
  it('403 for an admin on a super_admin-only handler', async () => {
    resolveAdminSession.mockResolvedValue(session('admin'));
    const res = await requireRole('super_admin')(ok)(contextFor('GET', '/api/operators'));
    expect(res.status).toBe(403);
    expect(ok).not.toHaveBeenCalled();
  });

  it('passes a super_admin', async () => {
    resolveAdminSession.mockResolvedValue(session('super_admin'));
    const res = await requireRole('super_admin')(ok)(contextFor('GET', '/api/operators'));
    expect(res.status).toBe(200);
  });

  it('an operator is stopped by withAuth before the role check', async () => {
    resolveAdminSession.mockResolvedValue(session('operator'));
    const res = await requireRole('operator')(ok)(contextFor('GET', '/api/operators'));
    expect(res.status).toBe(403);
    expect(ok).not.toHaveBeenCalled();
  });
});
