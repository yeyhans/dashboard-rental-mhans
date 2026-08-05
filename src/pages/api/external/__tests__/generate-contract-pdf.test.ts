import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../generate-contract-pdf';

describe('external contract PDF relay authorization', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects unauthorized relay requests before reading attacker-controlled JSON or calling fetch', async () => {
    vi.stubEnv('FRONTEND_API_SECRET', 'frontend-secret');
    const json = vi.fn(async () => ({ userData: { email: 'attacker@example.com' } }));
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const request = new Request('https://dashboard.mariohans.cl/api/external/generate-contract-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    Object.defineProperty(request, 'json', { value: json });

    const response = await POST({ request } as never);

    expect(response.status).toBe(401);
    expect(json).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('allows the existing server API key contract through the guard', async () => {
    vi.stubEnv('FRONTEND_API_SECRET', 'frontend-secret');
    const json = vi.fn(async () => {
      throw new Error('parse reached');
    });
    const request = new Request('https://dashboard.mariohans.cl/api/external/generate-contract-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'frontend-secret' },
      body: '{}',
    });
    Object.defineProperty(request, 'json', { value: json });

    const response = await POST({ request } as never);

    expect(response.status).toBe(500);
    expect(json).toHaveBeenCalledTimes(1);
  });

  it('allows X-API-Key in contract PDF CORS preflight headers', async () => {
    const { OPTIONS } = await import('../generate-contract-pdf');
    const response = await OPTIONS({
      request: new Request('https://dashboard.mariohans.cl/api/external/generate-contract-pdf', {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:4321' },
      }),
    } as never);

    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('X-API-Key');
  });
});
