import { afterEach, describe, expect, it, vi } from 'vitest';

const createProduct = vi.fn();

vi.mock('../../../../middleware/auth', () => ({
  withAuth: (handler: (context: any) => Promise<Response>) => async (context: any) => {
    if (!context.locals?.user) {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 });
    }
    return handler(context);
  },
}));

vi.mock('../../../../services/productService', () => ({
  ProductService: { createProduct },
}));

describe('catalogue create authorization (F3)', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects unauthenticated product creation before body parsing or any write', async () => {
    const json = vi.fn(async () => ({ name: 'Profoto B10', slug: 'profoto-b10', sku: 'PRO-B10' }));
    const request = new Request('https://dashboard.mariohans.cl/api/products/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    Object.defineProperty(request, 'json', { value: json });
    const { POST } = await import('../create');

    const response = await POST({ request, locals: {} } as never);

    expect(response.status).toBe(401);
    expect(json).not.toHaveBeenCalled();
    expect(createProduct).not.toHaveBeenCalled();
  });

  it('preserves authenticated product creation behavior', async () => {
    createProduct.mockResolvedValue({ id: 42, name: 'Profoto B10', slug: 'profoto-b10', sku: 'PRO-B10' });
    const request = new Request('https://dashboard.mariohans.cl/api/products/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Profoto B10', slug: 'profoto-b10', sku: 'PRO-B10' }),
    });
    const { POST } = await import('../create');

    const response = await POST({ request, locals: { user: { id: 'admin-1', role: 'admin' } } } as never);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.data.id).toBe(42);
    expect(createProduct).toHaveBeenCalledTimes(1);
  });

  it('still validates required fields once authenticated', async () => {
    const request = new Request('https://dashboard.mariohans.cl/api/products/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sin slug ni sku' }),
    });
    const { POST } = await import('../create');

    const response = await POST({ request, locals: { user: { id: 'admin-1', role: 'admin' } } } as never);

    expect(response.status).toBe(400);
    expect(createProduct).not.toHaveBeenCalled();
  });
});
