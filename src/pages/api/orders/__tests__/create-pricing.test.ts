import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `POST /api/orders` must not trust the money the caller computed. The route only tells the
 * service who is calling — the customer frontend authenticates with the shared API key, an admin
 * with a session — and the service recomputes every `calculated_*` field.
 */
const createOrder = vi.fn();

vi.mock('../../../../services/orderService', () => ({
  OrderService: { createOrder, getAllOrders: vi.fn(), getOrderStats: vi.fn() },
}));

const isFrontendApiKeyOrAdmin = vi.fn();
const validateFrontendApiKey = vi.fn();

vi.mock('../../../../lib/serverApiAuth', () => ({
  isFrontendApiKeyOrAdmin,
  validateFrontendApiKey,
  unauthorizedResponse: () => new Response('{}', { status: 401 }),
}));

function postOrder(body: Record<string, unknown>) {
  const href = 'https://dashboard.mariohans.cl/api/orders';
  return {
    request: new Request(href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: 42, billing_email: 'cliente@x.cl', status: 'request', ...body }),
    }),
    url: new URL(href),
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
  isFrontendApiKeyOrAdmin.mockResolvedValue(true);
  createOrder.mockResolvedValue({ id: 1, status: 'request' });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('POST /api/orders — precio calculado en el servidor', () => {
  it('tells the service the order comes from the customer frontend when the API key is valid', async () => {
    validateFrontendApiKey.mockReturnValue(true);
    const { POST } = await import('../index');

    await POST(postOrder({ calculated_total: 1 }) as never);

    expect(createOrder).toHaveBeenCalledWith(expect.any(Object), 'frontend');
  });

  it('treats a session caller as admin', async () => {
    validateFrontendApiKey.mockReturnValue(false);
    const { POST } = await import('../index');

    await POST(postOrder({}) as never);

    expect(createOrder).toHaveBeenCalledWith(expect.any(Object), 'admin');
  });

  it('answers 400 with the pricing message when the order cannot be priced', async () => {
    validateFrontendApiKey.mockReturnValue(true);
    const { PricingError } = await import('../../../../lib/pricing');
    createOrder.mockRejectedValue(new PricingError('La fecha de término no puede ser anterior a la de inicio'));
    const { POST } = await import('../index');

    const response = await POST(postOrder({}) as never);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      success: false,
      error: 'La fecha de término no puede ser anterior a la de inicio',
    });
  });
});
