import { afterEach, describe, expect, it, vi } from 'vitest';

const from = vi.fn();

vi.mock('../../../../middleware/auth', () => ({
  withAuth: (handler: (context: any) => Promise<Response>) => async (context: any) => {
    if (!context.locals?.user) {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 });
    }
    return handler(context);
  },
}));

vi.mock('../../../../lib/supabase', () => ({
  supabaseAdmin: { from },
}));

describe('catalogue batch read authorization (F3)', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects unauthenticated batch reads before body parsing or any service-role query', async () => {
    const json = vi.fn(async () => ({ ids: [1, 2, 3] }));
    const request = new Request('https://dashboard.mariohans.cl/api/products/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    Object.defineProperty(request, 'json', { value: json });
    const { POST } = await import('../batch');

    const response = await POST({ request, locals: {} } as never);

    expect(response.status).toBe(401);
    expect(json).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it('preserves authenticated batch read behavior, including requested-id ordering', async () => {
    from.mockReturnValue({
      select: () => ({
        in: async () => ({ data: [{ id: 2, name: 'B' }, { id: 1, name: 'A' }], error: null }),
      }),
    });
    const request = new Request('https://dashboard.mariohans.cl/api/products/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [1, 2] }),
    });
    const { POST } = await import('../batch');

    const response = await POST({ request, locals: { user: { id: 'admin-1', role: 'admin' } } } as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.map((p: { id: number }) => p.id)).toEqual([1, 2]);
  });
});
