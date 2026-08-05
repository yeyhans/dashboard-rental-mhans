import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../lib/supabase', () => ({
  getServerAdmin: vi.fn(async () => null),
}));

describe('contract PDF generation authorization', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects generic Supabase bearer tokens before reading JSON', async () => {
    const json = vi.fn(async () => ({ userData: { user_id: 1, email: 'cliente@example.com' } }));
    const { POST } = await import('../generate-pdf');
    const request = new Request('https://dashboard.mariohans.cl/api/contracts/generate-pdf', {
      method: 'POST',
      headers: { Authorization: 'Bearer customer-token' },
      body: '{}',
    });
    Object.defineProperty(request, 'json', { value: json });

    const response = await POST({ request } as never);

    expect(response.status).toBe(401);
    expect(json).not.toHaveBeenCalled();
  });
});
