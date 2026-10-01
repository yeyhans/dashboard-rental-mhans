import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * `PUT /api/orders/:id` is what the order detail "Editor de Pedido Completo" saves through. It
 * used to persist whatever totals the browser computed; the server now recomputes them.
 */
const getOrderById = vi.fn();
const updateOrder = vi.fn();
const priceOrderUpdate = vi.fn();

vi.mock('../../../../middleware/auth', () => ({
  withAuth: (handler: (context: unknown) => Promise<Response>) => handler,
}));

vi.mock('../../../../services/orderService', () => ({
  OrderService: { getOrderById, updateOrder, deleteOrder: vi.fn() },
}));

vi.mock('../../../../services/orderPricingService', () => ({
  OrderPricingService: { priceOrderUpdate },
}));

function put(body: Record<string, unknown>) {
  return {
    params: { id: '35' },
    request: new Request('https://dashboard.mariohans.cl/api/orders/35', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    locals: { user: { id: 'admin-1' } },
  } as never;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('PUT /api/orders/:id — montos calculados en el servidor', () => {
  const existing = { id: 35, calculated_total: 761600, calculated_iva: 121600 };

  it('overrides client totals with the recomputed ones and never writes apply_iva', async () => {
    getOrderById.mockResolvedValue(existing);
    const priced = {
      num_jornadas: 3,
      shipping_total: 0,
      calculated_subtotal: 640000,
      calculated_discount: 5000,
      calculated_iva: 121600,
      calculated_total: 761600,
      total: 761600,
    };
    priceOrderUpdate.mockResolvedValue(priced);
    updateOrder.mockResolvedValue({ ...existing, ...priced });
    const { PUT } = await import('../[id]');

    const body = { calculated_total: 767550, calculated_iva: 122550, apply_iva: true, line_items: [] };
    const response = await PUT(put(body));

    expect(response.status).toBe(200);
    expect(priceOrderUpdate).toHaveBeenCalledWith(existing, body);
    const written = updateOrder.mock.calls[0]?.[1];
    expect(written).toEqual(expect.objectContaining(priced));
    expect(written).not.toHaveProperty('apply_iva');
  });

  // The sibling `PUT /api/orders/update/:id` already validated the pair; this route did not, so an
  // out-of-range share reached the migration 0008 CHECK and came back to the panel as a raw 500.
  it.each([
    [{ reserve_type: 'percent', reserve_value: 150 }, 'porcentaje'],
    [{ reserve_type: 'ratio', reserve_value: 30 }, 'tipo'],
    [{ reserve_type: 'fixed', reserve_value: -1 }, 'número positivo'],
    [{ reserve_value: 30 }, 'juntos'],
    [{ reserve_type: 'percent' }, 'juntos'],
  ])('rejects an invalid reserve with 400 and never writes (%j)', async (body, fragment) => {
    getOrderById.mockResolvedValue(existing);
    priceOrderUpdate.mockResolvedValue(null);
    const { PUT } = await import('../[id]');

    const response = await PUT(put(body));
    const payload = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain(fragment);
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it('accepts a valid reserve pair and persists the coerced number', async () => {
    getOrderById.mockResolvedValue(existing);
    priceOrderUpdate.mockResolvedValue(null);
    updateOrder.mockResolvedValue(existing);
    const { PUT } = await import('../[id]');

    const response = await PUT(put({ reserve_type: 'percent', reserve_value: '30' }));

    expect(response.status).toBe(200);
    expect(updateOrder.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ reserve_type: 'percent', reserve_value: 30 })
    );
  });

  it('answers 400 on a pricing error without writing', async () => {
    getOrderById.mockResolvedValue(existing);
    const { PricingError } = await import('../../../../lib/pricing');
    priceOrderUpdate.mockRejectedValue(new PricingError('Número de jornadas inválido'));
    const { PUT } = await import('../[id]');

    const response = await PUT(put({ num_jornadas: 0 }));

    expect(response.status).toBe(400);
    expect(updateOrder).not.toHaveBeenCalled();
  });
});
