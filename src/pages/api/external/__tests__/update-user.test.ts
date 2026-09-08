import { afterEach, describe, expect, it, vi } from 'vitest';

const getUserById = vi.fn();
const updateUser = vi.fn();

vi.mock('../../../../services/userService', () => ({
  UserService: { getUserById, updateUser },
}));

/** Distinct IP per test — the rate limiter is module-level in-memory state (5 req/min per IP). */
function buildRequest(ip: string, apiKey: string | null, body: unknown): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-forwarded-for': ip,
  };
  if (apiKey !== null) headers['X-API-Key'] = apiKey;
  return new Request('https://dashboard.mariohans.cl/api/external/update-user', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('update-user dedicated Hermes secret', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects a request bearing only a valid FRONTEND_API_SECRET', async () => {
    vi.stubEnv('HERMES_API_SECRET', 'hermes-secret');
    vi.stubEnv('FRONTEND_API_SECRET', 'frontend-secret');
    const { POST } = await import('../update-user');

    const response = await POST({
      request: buildRequest('10.1.0.1', 'frontend-secret', {
        user_id: 7,
        fields: { nombre: 'Ana' },
      }),
    } as never);

    expect(response.status).toBe(401);
    expect(updateUser).not.toHaveBeenCalled();
    expect(getUserById).not.toHaveBeenCalled();
  });

  it('rejects the frontend secret even when HERMES_API_SECRET is not configured', async () => {
    vi.stubEnv('HERMES_API_SECRET', '');
    vi.stubEnv('FRONTEND_API_SECRET', 'frontend-secret');
    const { POST } = await import('../update-user');

    const response = await POST({
      request: buildRequest('10.1.0.2', 'frontend-secret', {
        user_id: 7,
        fields: { nombre: 'Ana' },
      }),
    } as never);

    expect(response.status).toBe(401);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('still accepts a valid HERMES_API_SECRET and preserves update behavior', async () => {
    vi.stubEnv('HERMES_API_SECRET', 'hermes-secret');
    getUserById.mockResolvedValue({ user_id: 7, email: 'cliente@example.com' });
    updateUser.mockResolvedValue({ user_id: 7, nombre: 'Ana' });
    const { POST } = await import('../update-user');

    const response = await POST({
      request: buildRequest('10.1.0.3', 'hermes-secret', {
        user_id: 7,
        fields: { nombre: 'Ana', telefono: '+56911111111' },
      }),
    } as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(updateUser).toHaveBeenCalledWith(7, { nombre: 'Ana', telefono: '+56911111111' });
  });

  it('preserves the 9-field allowlist rejection under the Hermes secret', async () => {
    vi.stubEnv('HERMES_API_SECRET', 'hermes-secret');
    const { POST } = await import('../update-user');

    const response = await POST({
      request: buildRequest('10.1.0.4', 'hermes-secret', {
        user_id: 7,
        fields: { nombre: 'Ana', url_user_contrato: 'https://evil.example/contract.pdf' },
      }),
    } as never);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('url_user_contrato');
    expect(updateUser).not.toHaveBeenCalled();
  });
});
