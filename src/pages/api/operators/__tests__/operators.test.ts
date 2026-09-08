import { afterEach, describe, expect, it, vi } from 'vitest';

import { OPERATOR_ERRORS } from '../../../../lib/operators';

/**
 * `/api/operators` and `/api/operators/[id]`. The service is mocked wholesale (its own suite covers
 * the two-write create and the rollback); `requireRole` is stubbed with the same shape the real
 * one has — 401 without a session, 403 outside the allowed roles — so the gating assertions here
 * are about WHICH roles the routes ask for, which is the part this file owns.
 */
const list = vi.fn();
const create = vi.fn();
const setActive = vi.fn();

vi.mock('../../../../middleware/auth', () => ({
  requireRole:
    (...roles: string[]) =>
    (handler: (context: any) => Promise<Response>) =>
    async (context: any) => {
      if (!context.locals?.user) {
        return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 });
      }
      if (!roles.includes(context.locals.user.role)) {
        return new Response(JSON.stringify({ success: false, error: 'Permisos insuficientes' }), { status: 403 });
      }
      return handler(context);
    },
}));

vi.mock('../../../../services/operatorService', () => ({
  OperatorService: { list, create, setActive },
}));

const superAdmin = { locals: { user: { id: 'sa', email: 'sa@x.cl', role: 'super_admin' } } };
const admin = { locals: { user: { id: 'a', email: 'a@x.cl', role: 'admin' } } };

const operator = {
  id: 12,
  user_id: 'auth-op-1',
  email: 'bodega@mariohans.cl',
  role: 'operator',
  is_active: true,
  created_at: '2026-09-08T10:00:00Z',
};

function jsonRequest(method: string, path: string, body?: unknown) {
  return new Request(`https://dashboard.mariohans.cl${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/operators', () => {
  it('requires authentication', async () => {
    const { GET } = await import('../index');
    const response = await GET({ request: jsonRequest('GET', '/api/operators'), locals: {} } as never);
    expect(response.status).toBe(401);
    expect(list).not.toHaveBeenCalled();
  });

  it('is super_admin only — a plain admin gets 403', async () => {
    const { GET } = await import('../index');
    const response = await GET({ request: jsonRequest('GET', '/api/operators'), ...admin } as never);
    expect(response.status).toBe(403);
    expect(list).not.toHaveBeenCalled();
  });

  it('lists operators for a super_admin', async () => {
    list.mockResolvedValue([operator]);
    const { GET } = await import('../index');
    const response = await GET({ request: jsonRequest('GET', '/api/operators'), ...superAdmin } as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, data: { operators: [operator], total: 1 } });
  });

  it('500 with a generic message on a service failure', async () => {
    list.mockRejectedValue(new Error('db down'));
    const { GET } = await import('../index');
    const response = await GET({ request: jsonRequest('GET', '/api/operators'), ...superAdmin } as never);
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.error).toBe('Error al obtener los operarios');
  });
});

describe('POST /api/operators', () => {
  it('is super_admin only', async () => {
    const { POST } = await import('../index');
    const response = await POST({
      request: jsonRequest('POST', '/api/operators', { email: 'a@b.cl', password: 'correcto1' }),
      ...admin,
    } as never);
    expect(response.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it('400 on invalid JSON', async () => {
    const { POST } = await import('../index');
    const response = await POST({ request: jsonRequest('POST', '/api/operators', '{nope'), ...superAdmin } as never);
    expect(response.status).toBe(400);
  });

  it('400 with the Spanish message on a bad email or short password', async () => {
    const { POST } = await import('../index');

    const badEmail = await POST({
      request: jsonRequest('POST', '/api/operators', { email: 'nope', password: 'correcto1' }),
      ...superAdmin,
    } as never);
    expect(badEmail.status).toBe(400);
    expect((await badEmail.json()).error).toBe(OPERATOR_ERRORS.INVALID_EMAIL);

    const shortPassword = await POST({
      request: jsonRequest('POST', '/api/operators', { email: 'a@b.cl', password: '1234567' }),
      ...superAdmin,
    } as never);
    expect(shortPassword.status).toBe(400);
    expect((await shortPassword.json()).error).toBe(OPERATOR_ERRORS.WEAK_PASSWORD);
    expect(create).not.toHaveBeenCalled();
  });

  it('201 with the created operator, passing the normalised input to the service', async () => {
    create.mockResolvedValue(operator);
    const { POST } = await import('../index');
    const response = await POST({
      request: jsonRequest('POST', '/api/operators', { email: ' Bodega@MarioHans.cl ', password: 'correcto1' }),
      ...superAdmin,
    } as never);
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body).toEqual({ success: true, data: operator });
    expect(create).toHaveBeenCalledWith({ email: 'bodega@mariohans.cl', password: 'correcto1' });
  });

  it('409 when the email is already registered', async () => {
    create.mockRejectedValue(new Error(OPERATOR_ERRORS.EMAIL_TAKEN));
    const { POST } = await import('../index');
    const response = await POST({
      request: jsonRequest('POST', '/api/operators', { email: 'a@b.cl', password: 'correcto1' }),
      ...superAdmin,
    } as never);
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe(OPERATOR_ERRORS.EMAIL_TAKEN);
  });

  it('500 generic on any other failure', async () => {
    create.mockRejectedValue(new Error('auth api down'));
    const { POST } = await import('../index');
    const response = await POST({
      request: jsonRequest('POST', '/api/operators', { email: 'a@b.cl', password: 'correcto1' }),
      ...superAdmin,
    } as never);
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe('Error al crear el operario');
  });
});

describe('PATCH /api/operators/[id]', () => {
  it('is super_admin only', async () => {
    const { PATCH } = await import('../[id]');
    const response = await PATCH({
      params: { id: '12' },
      request: jsonRequest('PATCH', '/api/operators/12', { is_active: false }),
      ...admin,
    } as never);
    expect(response.status).toBe(403);
    expect(setActive).not.toHaveBeenCalled();
  });

  it('400 on a non-numeric id', async () => {
    const { PATCH } = await import('../[id]');
    const response = await PATCH({
      params: { id: 'abc' },
      request: jsonRequest('PATCH', '/api/operators/abc', { is_active: false }),
      ...superAdmin,
    } as never);
    expect(response.status).toBe(400);
  });

  it('400 when is_active is not a boolean', async () => {
    const { PATCH } = await import('../[id]');
    const response = await PATCH({
      params: { id: '12' },
      request: jsonRequest('PATCH', '/api/operators/12', { is_active: 'false' }),
      ...superAdmin,
    } as never);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(OPERATOR_ERRORS.INVALID_ACTIVE_FLAG);
    expect(setActive).not.toHaveBeenCalled();
  });

  it('404 when no operator has that id', async () => {
    setActive.mockResolvedValue(null);
    const { PATCH } = await import('../[id]');
    const response = await PATCH({
      params: { id: '999' },
      request: jsonRequest('PATCH', '/api/operators/999', { is_active: false }),
      ...superAdmin,
    } as never);
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe(OPERATOR_ERRORS.NOT_FOUND);
  });

  it('200 with the updated row', async () => {
    const inactive = { ...operator, is_active: false };
    setActive.mockResolvedValue(inactive);
    const { PATCH } = await import('../[id]');
    const response = await PATCH({
      params: { id: '12' },
      request: jsonRequest('PATCH', '/api/operators/12', { is_active: false }),
      ...superAdmin,
    } as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, data: inactive });
    expect(setActive).toHaveBeenCalledWith(12, false);
  });
});
