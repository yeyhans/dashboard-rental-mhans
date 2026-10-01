import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOVEMENT_TRANSITION_ERRORS } from '../../../../lib/assetMovements';

/**
 * T-026 gap 1/4. See `assetMovementService.test.ts` for the transition-rule coverage; this suite
 * only verifies what the endpoint itself adds: auth gating, param validation, admin-id resolution
 * from the session, and status-code mapping (R3-101/102/103, review R3 on `4de3c5c`).
 */
const recordMovement = vi.fn();
const getHistoryForAsset = vi.fn();
const listByOrder = vi.fn();
const listFeed = vi.fn();

vi.mock('../../../../middleware/auth', () => ({
  withAuth: (handler: (context: any) => Promise<Response>) => async (context: any) => {
    if (!context.locals?.user) {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 });
    }
    return handler(context);
  },
}));

vi.mock('../../../../services/assetMovementService', () => ({
  AssetMovementService: { recordMovement, getHistoryForAsset, listByOrder, listFeed },
  FEED_DEFAULT_LIMIT: 200,
  FEED_MAX_LIMIT: 500,
}));

const admin = {
  locals: {
    user: { id: 'admin-auth-uid', email: 'admin@x.cl', role: 'admin' },
    adminSession: { admin: { id: 7 } },
  },
};

function postRequest(body: unknown) {
  return new Request('https://dashboard.mariohans.cl/api/inventory/movements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/inventory/movements', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    const request = postRequest({ asset_id: 1, order_id: 10, direction: 'checkout' });
    const { POST } = await import('../movements');

    const response = await POST({ request, locals: {} } as never);

    expect(response.status).toBe(401);
    expect(recordMovement).not.toHaveBeenCalled();
  });

  it('resolves checked_by_admin_id from the session, never from the request body (R1-002)', async () => {
    recordMovement.mockResolvedValue({ id: 1, asset_id: 1, order_id: 10, direction: 'checkout' });
    const request = postRequest({
      asset_id: 1,
      order_id: 10,
      direction: 'checkout',
      checked_by_admin_id: 999, // attacker-supplied — must be ignored
    });
    const { POST } = await import('../movements');

    await POST({ request, ...admin } as never);

    expect(recordMovement).toHaveBeenCalledWith(
      expect.objectContaining({ checked_by_admin_id: 7 })
    );
  });

  // R3-103: the endpoint's CLIENT_ERRORS matcher must use the SAME constants the pure validator
  // exports, not a duplicated literal — proven here by driving the actual mocked service error
  // through the endpoint and asserting the exact status/message pairing for both constants.
  it('maps MOVEMENT_TRANSITION_ERRORS.OPEN_CHECKOUT_EXISTS to 409 via the shared constant', async () => {
    recordMovement.mockRejectedValue(new Error(MOVEMENT_TRANSITION_ERRORS.OPEN_CHECKOUT_EXISTS));
    const request = postRequest({ asset_id: 1, order_id: 10, direction: 'checkout' });
    const { POST } = await import('../movements');

    const response = await POST({ request, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toBe(MOVEMENT_TRANSITION_ERRORS.OPEN_CHECKOUT_EXISTS);
  });

  it('maps MOVEMENT_TRANSITION_ERRORS.NO_OPEN_CHECKOUT to 409 via the shared constant', async () => {
    recordMovement.mockRejectedValue(new Error(MOVEMENT_TRANSITION_ERRORS.NO_OPEN_CHECKOUT));
    const request = postRequest({ asset_id: 1, order_id: 10, direction: 'checkin' });
    const { POST } = await import('../movements');

    const response = await POST({ request, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toBe(MOVEMENT_TRANSITION_ERRORS.NO_OPEN_CHECKOUT);
  });

  it('rejects a missing asset_id with a Spanish 400 and no service call', async () => {
    const request = postRequest({ order_id: 10, direction: 'checkout' });
    const { POST } = await import('../movements');

    const response = await POST({ request, ...admin } as never);

    expect(response.status).toBe(400);
    expect(recordMovement).not.toHaveBeenCalled();
  });

  it('hides internal failures behind a generic Spanish 500', async () => {
    recordMovement.mockRejectedValue(new Error('connection terminated unexpectedly'));
    const request = postRequest({ asset_id: 1, order_id: 10, direction: 'checkout' });
    const { POST } = await import('../movements');

    const response = await POST({ request, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).not.toContain('connection terminated');
  });
});

/**
 * Batch 3: GET without `asset_id`/`order_id` is the central feed. The two original lookups keep
 * their contract; these tests pin the new branch's parameter validation and pass-through.
 */
describe('GET /api/inventory/movements — feed', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  function getRequest(query = '') {
    return new Request(`https://dashboard.mariohans.cl/api/inventory/movements${query}`);
  }

  it('requires authentication', async () => {
    const { GET } = await import('../movements');
    const response = await GET({ request: getRequest(), locals: {} } as never);
    expect(response.status).toBe(401);
    expect(listFeed).not.toHaveBeenCalled();
  });

  it('returns the feed with defaults when no params are given', async () => {
    const feed = { movements: [], kpis: { unitsOutNow: 0, unitsOverdue: 0, movementsToday: 0 }, operators: [], generatedAt: 'x' };
    listFeed.mockResolvedValue(feed);
    const { GET } = await import('../movements');

    const response = await GET({ request: getRequest(), ...admin } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, data: feed });
    expect(listFeed).toHaveBeenCalledWith({ since: null, until: null, direction: null, adminId: null, limit: 200 });
  });

  it('forwards since/until (normalised), direction, admin_id and limit', async () => {
    listFeed.mockResolvedValue({ movements: [] });
    const { GET } = await import('../movements');

    await GET({
      request: getRequest('?since=2026-09-08T00:00:00Z&until=2026-09-09T00:00:00Z&direction=checkin&admin_id=7&limit=50'),
      ...admin,
    } as never);

    expect(listFeed).toHaveBeenCalledWith({
      since: '2026-09-08T00:00:00.000Z',
      until: '2026-09-09T00:00:00.000Z',
      direction: 'checkin',
      adminId: 7,
      limit: 50,
    });
  });

  it.each([
    ['?since=ayer', 'since'],
    ['?until=nunca', 'until'],
    ['?direction=sideways', 'Dirección inválida'],
    ['?admin_id=abc', 'operario'],
    ['?limit=0', 'limit'],
    ['?limit=9999', 'limit'],
  ])('400 on %s', async (query, fragment) => {
    const { GET } = await import('../movements');
    const response = await GET({ request: getRequest(query), ...admin } as never);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain(fragment);
    expect(listFeed).not.toHaveBeenCalled();
  });

  it('still serves the per-asset and per-order lookups unchanged', async () => {
    getHistoryForAsset.mockResolvedValue([{ id: 1 }]);
    listByOrder.mockResolvedValue([{ id: 2 }, { id: 3 }]);
    const { GET } = await import('../movements');

    const byAsset = await (await GET({ request: getRequest('?asset_id=5'), ...admin } as never)).json();
    const byOrder = await (await GET({ request: getRequest('?order_id=9'), ...admin } as never)).json();

    expect(byAsset).toEqual({ success: true, data: { movements: [{ id: 1 }], total: 1 } });
    expect(byOrder).toEqual({ success: true, data: { movements: [{ id: 2 }, { id: 3 }], total: 2 } });
    expect(listFeed).not.toHaveBeenCalled();
  });

  it('hides a feed failure behind the generic Spanish 500', async () => {
    listFeed.mockRejectedValue(new Error('db'));
    const { GET } = await import('../movements');
    const response = await GET({ request: getRequest(), ...admin } as never);
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe('Error al consultar los movimientos');
  });
});
