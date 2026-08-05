import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../generate-budget-pdf';

describe('external budget PDF relay authorization', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects generic Supabase bearer tokens before reading JSON or calling fetch', async () => {
    vi.stubEnv('FRONTEND_API_SECRET', 'frontend-secret');
    const json = vi.fn(async () => ({ orderData: { customer_id: 1 } }));
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const request = new Request('https://dashboard.mariohans.cl/api/external/generate-budget-pdf', {
      method: 'POST',
      headers: { Authorization: 'Bearer customer-token', 'Content-Type': 'application/json' },
      body: '{}',
    });
    Object.defineProperty(request, 'json', { value: json });

    const response = await POST({ request } as never);

    expect(response.status).toBe(401);
    expect(json).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
