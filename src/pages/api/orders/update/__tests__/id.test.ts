import { afterEach, describe, expect, it, vi } from 'vitest';

const updateOrder = vi.fn();
const from = vi.fn();

vi.mock('../../../../../middleware/auth', () => ({
  withAuth: (handler: (context: any) => Promise<Response>) => async (context: any) => {
    if (!context.locals?.user) {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 });
    }
    return handler(context);
  },
}));

vi.mock('../../../../../services/orderService', () => ({
  OrderService: { updateOrder },
}));

vi.mock('../../../../../lib/supabase', () => ({
  supabaseAdmin: { from },
}));

describe('admin order update relay boundary', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects unauthenticated requests before body parsing, order update, or email relay', async () => {
    const json = vi.fn(async () => ({ status: 'completed' }));
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const request = new Request('https://dashboard.mariohans.cl/api/orders/update/123', {
      method: 'PUT',
      body: '{}',
    });
    Object.defineProperty(request, 'json', { value: json });
    const { PUT } = await import('../[id]');

    const response = await PUT({ params: { id: '123' }, request, locals: {} } as never);

    expect(response.status).toBe(401);
    expect(json).not.toHaveBeenCalled();
    expect(updateOrder).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('preserves authenticated admin status updates and notification relay behavior', async () => {
    vi.stubEnv('FRONTEND_API_SECRET', 'frontend-secret');
    const currentOrder = { id: 123, status: 'processing', billing_email: 'cliente@example.com' };
    const updatedOrder = { ...currentOrder, status: 'completed' };
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: currentOrder, error: null }),
        }),
      }),
    });
    updateOrder.mockResolvedValue(updatedOrder);
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const request = new Request('https://dashboard.mariohans.cl/api/orders/update/123', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    const { PUT } = await import('../[id]');

    const response = await PUT({ params: { id: '123' }, request, locals: { user: { id: 'admin-1' } } } as never);
    expect(response.status).toBe(200);
    expect(updateOrder).toHaveBeenCalledWith(123, expect.objectContaining({ status: 'completed' }));
    expect(fetchSpy).toHaveBeenCalledWith('https://dashboard.mariohans.cl/api/emails/send-order-completed-notification', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'X-API-Key': 'frontend-secret', 'X-Request-ID': expect.any(String) }),
    }));
  });

  it('does not persist status update when required notification fails', async () => {
    vi.stubEnv('FRONTEND_API_SECRET', 'frontend-secret');
    const currentOrder = { id: 123, status: 'processing', billing_email: 'cliente@example.com' };
    const updatedOrder = { ...currentOrder, status: 'failed' };
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: currentOrder, error: null }),
        }),
      }),
    });
    updateOrder.mockResolvedValue(updatedOrder);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('delivery failed', { status: 500 })));
    const request = new Request('https://dashboard.mariohans.cl/api/orders/update/123', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'failed' }),
    });
    const { PUT } = await import('../[id]');

    const response = await PUT({ params: { id: '123' }, request, locals: { user: { id: 'admin-1' } } } as never);

    expect(response.status).toBe(502);
    expect(updateOrder).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      success: false,
      notificationError: 'required_notification_failed',
    }));
  });
});
