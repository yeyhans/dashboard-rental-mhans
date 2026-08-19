import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * T-014b. `PUT /api/orders/[id]/status` wrote `orders.status` through the JWT-less anon client
 * and had no `withAuth` at all: any unauthenticated caller could move an order to `completed`.
 * Migration 0001 revokes anon UPDATE, so the route breaks anyway. It now runs behind the admin
 * gate on top of `OrderService` (service role).
 */
const authGetUser = vi.fn();
const refreshSession = vi.fn();
const adminFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: authGetUser, refreshSession },
    from: adminFrom,
  }),
}));

const updateOrderStatus = vi.fn();

const getOrderById = vi.fn();

vi.mock('../../../../../services/orderService', () => ({
  OrderService: { updateOrderStatus, getOrderById },
}));

function stubAdminLookup(result: { data: unknown; error: unknown }) {
  adminFrom.mockReturnValue({
    select: () => ({ eq: () => ({ in: () => ({ single: () => Promise.resolve(result) }) }) }),
  });
}

function asAdmin() {
  authGetUser.mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@x.cl' } }, error: null });
  stubAdminLookup({ data: { id: 1, user_id: 'admin-1', email: 'admin@x.cl', role: 'admin' }, error: null });
}

function context(options: { cookie?: string; body?: unknown; id?: string } = {}) {
  const { cookie, body = {}, id = '123' } = options;
  const href = `https://dashboard.mariohans.cl/api/orders/${id}/status`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.cookie = cookie;

  return {
    params: { id },
    url: new URL(href),
    request: new Request(href, { method: 'PUT', headers, body: JSON.stringify(body) }),
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
  refreshSession.mockResolvedValue({ data: {}, error: { message: 'Invalid Refresh Token' } });
  // Por defecto la orden esta una etapa antes de `confirmed`, para que los casos felices avancen
  // de forma legal. Cada test de transicion sobreescribe este estado de origen.
  getOrderById.mockResolvedValue({ id: 123, status: 'evaluation' });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('PUT /api/orders/[id]/status', () => {

  it('rejects an unauthenticated status change', async () => {
    const { PUT } = await import('../status');

    const response = await PUT(context({ body: { status: 'completed' } }) as never);

    expect(response.status).toBe(401);
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it('updates the status for an authenticated admin', async () => {
    asAdmin();
    updateOrderStatus.mockResolvedValue({ id: 123, status: 'confirmed' });
    const { PUT } = await import('../status');

    const response = await PUT(context({ cookie: 'sb-access-token=valid-jwt', body: { status: 'confirmed' } }) as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.status).toBe('confirmed');
    expect(updateOrderStatus).toHaveBeenCalledWith(123, 'confirmed');
  });

  /**
   * T-019. The v1.2 vocabulary (`order-state-machine/spec.md`). The route reads its allowlist from
   * `src/lib/orderStatus.ts` rather than keeping its own copy — this route's hand-written list was
   * one of 29 in `src/`, which is what made the migration a 29-edit problem instead of one.
   */
  it.each(['request', 'evaluation', 'confirmed', 'preparation', 'in-rental', 'return', 'completed', 'cancelled'])(
    'accepts the v1.2 status %s',
    async (status) => {
      asAdmin();
      // Origin is a legacy value on purpose. This test asks one question — does the VOCABULARY
      // admit this status — and the state machine must not answer it. From a v1.2 origin only two
      // of the eight targets are ever legal, so a shared origin would make six of these fail for
      // a reason that has nothing to do with the vocabulary. A legacy origin is outside the
      // machine's knowledge, so it defers, and the vocabulary check is what decides.
      getOrderById.mockResolvedValue({ id: 123, status: 'on-hold' });
      updateOrderStatus.mockResolvedValue({ id: 123, status });
      const { PUT } = await import('../status');

      const response = await PUT(context({ cookie: 'sb-access-token=valid-jwt', body: { status } }) as never);

      expect(response.status).toBe(200);
      expect(updateOrderStatus).toHaveBeenCalledWith(123, status);
    }
  );

  /**
   * After 0003 the database CHECK rejects these too, but as a constraint violation this route
   * turns into a 500 — "Error al actualizar" with no indication of which value was wrong. The
   * 400 has to come from here.
   */
  it.each(['on-hold', 'processing', 'pending', 'refunded', 'failed'])(
    'rejects the legacy status %s without reaching the service',
    async (legacy) => {
      asAdmin();
      const { PUT } = await import('../status');

      const response = await PUT(context({ cookie: 'sb-access-token=valid-jwt', body: { status: legacy } }) as never);

      expect(response.status).toBe(400);
      expect(updateOrderStatus).not.toHaveBeenCalled();
    }
  );

  /**
   * `reviewing`, `preparing`, `delivering` and `paid` appear in the workflow documentation but
   * were never database values. `trash` and `auto-draft` were in the route's old allowlist and the
   * constraint always rejected them — a guaranteed 500 rather than a 400.
   */
  it.each(['trash', 'auto-draft', 'reviewing', 'preparing', 'delivering', 'paid'])(
    'rejects %s, which the database never accepted',
    async (bogus) => {
      asAdmin();
      const { PUT } = await import('../status');

      const response = await PUT(context({ cookie: 'sb-access-token=valid-jwt', body: { status: bogus } }) as never);
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.error).toContain('Estado inválido');
      expect(updateOrderStatus).not.toHaveBeenCalled();
    }
  );

  it('names the accepted values in the error, so a stale client can be corrected', async () => {
    asAdmin();
    const { PUT } = await import('../status');

    const response = await PUT(context({ cookie: 'sb-access-token=valid-jwt', body: { status: 'on-hold' } }) as never);
    const payload = await response.json();

    expect(payload.error).toContain('in-rental');
    expect(payload.error).not.toContain('on-hold');
  });

  it('returns 500 without leaking the database error text to the caller', async () => {
    asAdmin();
    updateOrderStatus.mockRejectedValue(new Error('violates check constraint "orders_status_check"'));
    const { PUT } = await import('../status');

    const response = await PUT(context({ cookie: 'sb-access-token=valid-jwt', body: { status: 'confirmed' } }) as never);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).not.toMatch(/constraint|orders_status_check/i);
  });

  it('rejects a non-numeric order id', async () => {
    asAdmin();
    const { PUT } = await import('../status');

    const response = await PUT(context({ cookie: 'sb-access-token=valid-jwt', id: 'abc', body: { status: 'processing' } }) as never);

    expect(response.status).toBe(400);
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it('requires a status field', async () => {
    asAdmin();
    const { PUT } = await import('../status');

    const response = await PUT(context({ cookie: 'sb-access-token=valid-jwt', body: {} }) as never);

    expect(response.status).toBe(400);
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });
});

/**
 * State machine enforcement (Área 01 §5 `TRANSICIONES_VALIDAS`, via `src/lib/orderStatus.ts`).
 *
 * The vocabulary check above answers "is this a real status". It cannot answer "is this a legal
 * move", and the two failures look nothing alike: a stale client sends a status that does not
 * exist, whereas a mis-click in Área 01 sends a perfectly valid status from the wrong stage. The
 * second one is the dangerous case — it is how an order reaches `in-rental` without anyone having
 * assigned units by serial number during `preparation`, and nothing downstream would flag it.
 */
describe('PUT /api/orders/[id]/status — transiciones', () => {
  it('advances one stage along the chain', async () => {
    asAdmin();
    getOrderById.mockResolvedValue({ id: 123, status: 'preparation' });
    updateOrderStatus.mockResolvedValue({ id: 123, status: 'in-rental' });
    const { PUT } = await import('../status');

    const response = await PUT(context({ cookie: 'sb-access-token=valid-jwt', body: { status: 'in-rental' } }) as never);

    expect(response.status).toBe(200);
    expect(updateOrderStatus).toHaveBeenCalledWith(123, 'in-rental');
  });

  it('refuses to skip a stage, naming the only legal next one', async () => {
    asAdmin();
    getOrderById.mockResolvedValue({ id: 123, status: 'confirmed' });
    const { PUT } = await import('../status');

    const response = await PUT(context({ cookie: 'sb-access-token=valid-jwt', body: { status: 'in-rental' } }) as never);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toContain('Preparación');
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it('refuses to move backwards', async () => {
    asAdmin();
    getOrderById.mockResolvedValue({ id: 123, status: 'in-rental' });
    const { PUT } = await import('../status');

    const response = await PUT(context({ cookie: 'sb-access-token=valid-jwt', body: { status: 'preparation' } }) as never);

    expect(response.status).toBe(409);
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it('allows cancelling from a non-terminal stage', async () => {
    asAdmin();
    getOrderById.mockResolvedValue({ id: 123, status: 'evaluation' });
    updateOrderStatus.mockResolvedValue({ id: 123, status: 'cancelled' });
    const { PUT } = await import('../status');

    const response = await PUT(context({ cookie: 'sb-access-token=valid-jwt', body: { status: 'cancelled' } }) as never);

    expect(response.status).toBe(200);
  });

  it('refuses to reopen a completed order', async () => {
    asAdmin();
    getOrderById.mockResolvedValue({ id: 123, status: 'completed' });
    const { PUT } = await import('../status');

    const response = await PUT(context({ cookie: 'sb-access-token=valid-jwt', body: { status: 'return' } }) as never);

    expect(response.status).toBe(409);
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it('returns 404 when the order does not exist', async () => {
    asAdmin();
    getOrderById.mockResolvedValue(null);
    const { PUT } = await import('../status');

    const response = await PUT(context({ cookie: 'sb-access-token=valid-jwt', body: { status: 'confirmed' } }) as never);

    expect(response.status).toBe(404);
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it('lets an order still on a legacy status be migrated forward by hand', async () => {
    // Between the code deploy and the 0003 apply, live rows still hold `on-hold`. Refusing every
    // move on those would freeze the panel during the window; the machine cannot judge a
    // transition whose origin is not in its vocabulary, so it defers to the vocabulary check.
    asAdmin();
    getOrderById.mockResolvedValue({ id: 123, status: 'on-hold' });
    updateOrderStatus.mockResolvedValue({ id: 123, status: 'request' });
    const { PUT } = await import('../status');

    const response = await PUT(context({ cookie: 'sb-access-token=valid-jwt', body: { status: 'request' } }) as never);

    expect(response.status).toBe(200);
  });
});
