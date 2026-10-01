import { afterEach, describe, expect, it, vi } from 'vitest';

const getUserByEmail = vi.fn();
const createUser = vi.fn();

vi.mock('../../../../services/userService', () => ({
  UserService: { getUserByEmail, createUser },
}));

/**
 * Each test uses a distinct client IP: the rate limiter is module-level in-memory state
 * (5 req/min per IP, shared across every test in this file).
 */
function buildRequest(ip: string, apiKey: string | null, body: unknown): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-forwarded-for': ip,
  };
  if (apiKey !== null) headers['X-API-Key'] = apiKey;
  return new Request('https://dashboard.mariohans.cl/api/external/create-user', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('create-user dedicated Hermes secret', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects a request bearing only a valid FRONTEND_API_SECRET', async () => {
    vi.stubEnv('HERMES_API_SECRET', 'hermes-secret');
    vi.stubEnv('FRONTEND_API_SECRET', 'frontend-secret');
    const { POST } = await import('../create-user');

    const response = await POST({
      request: buildRequest('10.0.0.1', 'frontend-secret', { email: 'cliente@example.com' }),
    } as never);

    expect(response.status).toBe(401);
    expect(createUser).not.toHaveBeenCalled();
    expect(getUserByEmail).not.toHaveBeenCalled();
  });

  it('rejects the frontend secret even when HERMES_API_SECRET is not configured', async () => {
    vi.stubEnv('HERMES_API_SECRET', '');
    vi.stubEnv('FRONTEND_API_SECRET', 'frontend-secret');
    const { POST } = await import('../create-user');

    const response = await POST({
      request: buildRequest('10.0.0.2', 'frontend-secret', { email: 'cliente@example.com' }),
    } as never);

    expect(response.status).toBe(401);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('still accepts a valid HERMES_API_SECRET and preserves creation behavior', async () => {
    vi.stubEnv('HERMES_API_SECRET', 'hermes-secret');
    vi.stubEnv('FRONTEND_API_SECRET', 'frontend-secret');
    getUserByEmail.mockResolvedValue(null);
    createUser.mockResolvedValue({
      user_id: 7,
      email: 'cliente@example.com',
      nombre: 'Ana',
      apellido: 'Soto',
      tipo_cliente: 'natural',
    });
    const { POST } = await import('../create-user');

    const response = await POST({
      request: buildRequest('10.0.0.3', 'hermes-secret', {
        email: 'Cliente@Example.com',
        nombre: 'Ana',
        apellido: 'Soto',
        tipo_cliente: 'natural',
      }),
    } as never);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.data.user_id).toBe(7);
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'cliente@example.com', nombre: 'Ana' })
    );
  });

  it('preserves idempotent-by-email 409 behavior under the Hermes secret', async () => {
    vi.stubEnv('HERMES_API_SECRET', 'hermes-secret');
    getUserByEmail.mockResolvedValue({ user_id: 7, email: 'cliente@example.com' });
    const { POST } = await import('../create-user');

    const response = await POST({
      request: buildRequest('10.0.0.4', 'hermes-secret', { email: 'cliente@example.com' }),
    } as never);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.code).toBe('DUPLICATE_EMAIL');
    expect(createUser).not.toHaveBeenCalled();
  });

  it('preserves the 5-req/min rate limit ahead of authentication', async () => {
    vi.stubEnv('HERMES_API_SECRET', 'hermes-secret');
    const { POST } = await import('../create-user');

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const response = await POST({
        request: buildRequest('10.0.0.5', 'wrong-secret', { email: 'cliente@example.com' }),
      } as never);
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
  });
});
