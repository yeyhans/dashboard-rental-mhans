import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../middleware/auth', () => ({
  withAuth: (handler: (context: any) => Promise<Response>) => async (context: any) => {
    if (!context.locals?.user) {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 });
    }
    return handler(context);
  },
}));

describe('manual email relay authorization', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('remains protected by the admin cookie auth path before Worker fetch handling', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const request = new Request('https://dashboard.mariohans.cl/api/emails/send-manual-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'attacker@example.com', subject: 'Injected', html: '<p>Injected</p>' }),
    });

    const { POST } = await import('../send-manual-email');
    const response = await POST({ request, cookies: { get: vi.fn() }, locals: {} } as never);

    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
