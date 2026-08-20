import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `POST /api/orders` is the seam between the two codebases: the customer frontend creates every
 * reservation through it, and `frontend/src/services/backendOrderService.ts` defaults the status
 * to `'on-hold'`.
 *
 * Migration 0003 removes `on-hold` from `orders_status_check`. The moment it applies, that insert
 * starts failing on a constraint violation and NO CUSTOMER CAN RESERVE — a full outage of the
 * commercial flow, caused by a value the frontend has always sent.
 *
 * The fix belongs here rather than in the frontend. Fixing it there would require the frontend
 * deploy and the migration apply to land in the same instant: flip the default too early and the
 * OLD constraint rejects `request`, producing the identical outage mirrored. Normalising on the
 * server makes both orders of events safe, so the two repositories can ship independently.
 */
const createOrder = vi.fn();

vi.mock('../../../../services/orderService', () => ({
  OrderService: { createOrder, getAllOrders: vi.fn(), getOrderStats: vi.fn() },
}));

const isFrontendApiKeyOrAdmin = vi.fn();
const unauthorizedResponse = vi.fn(
  () => new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 })
);

vi.mock('../../../../lib/serverApiAuth', () => ({
  isFrontendApiKeyOrAdmin,
  unauthorizedResponse,
}));

function postOrder(body: Record<string, unknown>) {
  const href = 'https://dashboard.mariohans.cl/api/orders';
  return {
    request: new Request(href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'https://rental.mariohans.cl' },
      body: JSON.stringify({
        customer_id: 42,
        billing_email: 'cliente@x.cl',
        ...body,
      }),
    }),
    url: new URL(href),
  };
}

/** The status the service was actually asked to persist. */
function persistedStatus(): unknown {
  return createOrder.mock.calls[0]?.[0]?.status;
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
  isFrontendApiKeyOrAdmin.mockResolvedValue(true);
  createOrder.mockResolvedValue({ id: 999, status: 'request' });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('POST /api/orders — normalización de estado', () => {
  it('persists request when the frontend sends the legacy on-hold', async () => {
    // The exact live call: backendOrderService.ts:126 sends `status: 'on-hold'`.
    const { POST } = await import('../index');

    const response = await POST(postOrder({ status: 'on-hold' }) as never);

    expect(response.status).toBe(201);
    expect(persistedStatus()).toBe('request');
  });

  it('defaults to request when no status is sent at all', async () => {
    const { POST } = await import('../index');

    const response = await POST(postOrder({}) as never);

    expect(response.status).toBe(201);
    expect(persistedStatus()).toBe('request');
  });

  it.each([
    ['pending', 'request'],
    ['processing', 'confirmed'],
    ['failed', 'cancelled'],
    ['refunded', 'cancelled'],
  ])('folds the legacy %s onto %s', async (legacy, expected) => {
    const { POST } = await import('../index');

    await POST(postOrder({ status: legacy }) as never);

    expect(persistedStatus()).toBe(expected);
  });

  it('passes a v1.2 status through untouched, so the frontend can migrate whenever it likes', async () => {
    const { POST } = await import('../index');

    await POST(postOrder({ status: 'request' }) as never);

    expect(persistedStatus()).toBe('request');
  });

  it('rejects a status neither vocabulary defines instead of quietly defaulting it', async () => {
    // `reviewing`, `preparing`, `delivering` and `paid` appear in the workflow documentation and
    // in the frontend timeline, but no constraint ever admitted them. Silently turning one into
    // `request` would hide a real bug in the caller behind a 201.
    const { POST } = await import('../index');

    const response = await POST(postOrder({ status: 'paid' }) as never);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('still requires customer_id and billing_email', async () => {
    const { POST } = await import('../index');
    const href = 'https://dashboard.mariohans.cl/api/orders';

    const response = await POST({
      request: new Request(href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'request' }),
      }),
      url: new URL(href),
    } as never);

    expect(response.status).toBe(400);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('does not create an order for an unauthenticated caller', async () => {
    isFrontendApiKeyOrAdmin.mockResolvedValue(false);
    const { POST } = await import('../index');

    const response = await POST(postOrder({ status: 'on-hold' }) as never);

    expect(response.status).toBe(401);
    expect(createOrder).not.toHaveBeenCalled();
  });
});
