import { afterEach, describe, expect, it, vi } from 'vitest';

const getProductById = vi.fn();
const updateProduct = vi.fn();

vi.mock('../../../../middleware/auth', () => ({
  withAuth: (handler: (context: any) => Promise<Response>) => async (context: any) => {
    if (!context.locals?.user) {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 });
    }
    return handler(context);
  },
}));

vi.mock('../../../../services/productService', () => ({
  ProductService: { getProductById, updateProduct },
}));

const admin = { locals: { user: { id: 'admin-1', email: 'admin@x.cl', role: 'admin' } } };

function putRequest(body: unknown) {
  return new Request('https://dashboard.mariohans.cl/api/products/42', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * PUT /api/products/[id] with the valuation fields (0010). The route forwards arbitrary product
 * updates as it always has; the three spreadsheet columns are the exception — they are validated
 * here, server-side, because the CHECK constraint would otherwise surface a typo as a bare 500.
 */
describe('PUT /api/products/[id] — valuation fields', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication before reading the body', async () => {
    const request = putRequest({ declared_quantity: 5 });
    const json = vi.fn(async () => ({}));
    Object.defineProperty(request, 'json', { value: json });
    const { PUT } = await import('../[id]');

    const response = await PUT({ request, params: { id: '42' }, locals: {} } as never);

    expect(response.status).toBe(401);
    expect(json).not.toHaveBeenCalled();
    expect(updateProduct).not.toHaveBeenCalled();
  });

  it('stores the three fields as integers when they are valid', async () => {
    getProductById.mockResolvedValue({ id: 42 });
    updateProduct.mockResolvedValue({ id: 42, declared_quantity: 5, market_value_clp: 900000, used_value_clp: 600000 });
    const request = putRequest({ declared_quantity: '5', market_value_clp: 900000, used_value_clp: '600000' });
    const { PUT } = await import('../[id]');

    const response = await PUT({ request, params: { id: '42' }, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(updateProduct).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ declared_quantity: 5, market_value_clp: 900000, used_value_clp: 600000 })
    );
  });

  it('clears a value when the field arrives blank or null', async () => {
    getProductById.mockResolvedValue({ id: 42 });
    updateProduct.mockResolvedValue({ id: 42 });
    const request = putRequest({ declared_quantity: '', used_value_clp: null });
    const { PUT } = await import('../[id]');

    await PUT({ request, params: { id: '42' }, ...admin } as never);

    expect(updateProduct).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ declared_quantity: null, used_value_clp: null })
    );
  });

  it('rejects a negative or decimal value with a Spanish 400 and writes nothing', async () => {
    getProductById.mockResolvedValue({ id: 42 });
    const { PUT } = await import('../[id]');

    for (const bad of [{ declared_quantity: -1 }, { market_value_clp: 12.5 }, { used_value_clp: 'mil' }]) {
      const response = await PUT({ request: putRequest(bad), params: { id: '42' }, ...admin } as never);
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload).toEqual({ success: false, error: 'El valor debe ser un número entero mayor o igual a 0' });
    }
    expect(updateProduct).not.toHaveBeenCalled();
  });

  it('never persists a total — a total_value_clp in the body is dropped before the write', async () => {
    getProductById.mockResolvedValue({ id: 42 });
    updateProduct.mockResolvedValue({ id: 42 });
    const request = putRequest({ used_value_clp: 100, total_value_clp: 999999 });
    const { PUT } = await import('../[id]');

    await PUT({ request, params: { id: '42' }, ...admin } as never);

    const updates = updateProduct.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(updates.used_value_clp).toBe(100);
    expect(updates).not.toHaveProperty('total_value_clp');
  });

  it('keeps forwarding unrelated product fields untouched', async () => {
    getProductById.mockResolvedValue({ id: 42 });
    updateProduct.mockResolvedValue({ id: 42, name: 'Profoto B10' });
    const request = putRequest({ name: 'Profoto B10' });
    const { PUT } = await import('../[id]');

    const response = await PUT({ request, params: { id: '42' }, ...admin } as never);

    expect(response.status).toBe(200);
    expect(updateProduct).toHaveBeenCalledWith(42, expect.objectContaining({ name: 'Profoto B10' }));
  });

  it('answers 404 for a product that does not exist', async () => {
    getProductById.mockResolvedValue(null);
    const request = putRequest({ declared_quantity: 1 });
    const { PUT } = await import('../[id]');

    const response = await PUT({ request, params: { id: '999' }, ...admin } as never);

    expect(response.status).toBe(404);
    expect(updateProduct).not.toHaveBeenCalled();
  });
});
