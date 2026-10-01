import { afterEach, describe, expect, it, vi } from 'vitest';
import { SHIPMENT_TRANSITION_ERRORS } from '../../../../../lib/delivery';

/**
 * T-026 gap 2/4 (R3-205 fix). See `deliveryService.test.ts` for the transition-rule coverage;
 * this suite only verifies what the endpoint adds: auth gating, param/body validation, and
 * status-code mapping — same posture as `inventory/__tests__/movements.test.ts` (R3-101/102/103).
 */
const updateShipmentStatus = vi.fn();

vi.mock('../../../../../middleware/auth', () => ({
  withAuth: (handler: (context: any) => Promise<Response>) => async (context: any) => {
    if (!context.locals?.user) {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 });
    }
    return handler(context);
  },
}));

vi.mock('../../../../../services/deliveryService', () => ({
  DeliveryService: { updateShipmentStatus },
}));

const admin = { locals: { user: { id: 'admin-auth-uid', email: 'admin@x.cl', role: 'admin' } } };

function putRequest(body: unknown) {
  return new Request('https://dashboard.mariohans.cl/api/delivery/shipments/1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PUT /api/delivery/shipments/:id', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    const request = putRequest({ status: 'shipped' });
    const { PUT } = await import('../[id]');

    const response = await PUT({ request, params: { id: '1' }, locals: {} } as never);

    expect(response.status).toBe(401);
    expect(updateShipmentStatus).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric id with a Spanish 400 and no service call', async () => {
    const request = putRequest({ status: 'shipped' });
    const { PUT } = await import('../[id]');

    const response = await PUT({ request, params: { id: 'abc' }, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(updateShipmentStatus).not.toHaveBeenCalled();
  });

  it('rejects a status outside the CHECK vocabulary before calling the service', async () => {
    const request = putRequest({ status: 'en-camino' });
    const { PUT } = await import('../[id]');

    const response = await PUT({ request, params: { id: '1' }, ...admin } as never);

    expect(response.status).toBe(400);
    expect(updateShipmentStatus).not.toHaveBeenCalled();
  });

  it('returns {success, data} with the updated shipment on success', async () => {
    updateShipmentStatus.mockResolvedValue({ id: 1, status: 'shipped', shippedAt: '2026-08-23T10:00:00Z', deliveredAt: null });
    const request = putRequest({ status: 'shipped' });
    const { PUT } = await import('../[id]');

    const response = await PUT({ request, params: { id: '1' }, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      success: true,
      data: { id: 1, status: 'shipped', shippedAt: '2026-08-23T10:00:00Z', deliveredAt: null },
    });
  });

  it('maps SHIPMENT_TRANSITION_ERRORS.ILLEGAL to 409 via the shared constant', async () => {
    updateShipmentStatus.mockRejectedValue(new Error(SHIPMENT_TRANSITION_ERRORS.ILLEGAL));
    const request = putRequest({ status: 'shipped' });
    const { PUT } = await import('../[id]');

    const response = await PUT({ request, params: { id: '1' }, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toBe(SHIPMENT_TRANSITION_ERRORS.ILLEGAL);
  });

  it('maps SHIPMENT_TRANSITION_ERRORS.NOT_FOUND to 404 via the shared constant', async () => {
    updateShipmentStatus.mockRejectedValue(new Error(SHIPMENT_TRANSITION_ERRORS.NOT_FOUND));
    const request = putRequest({ status: 'shipped' });
    const { PUT } = await import('../[id]');

    const response = await PUT({ request, params: { id: '999' }, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe(SHIPMENT_TRANSITION_ERRORS.NOT_FOUND);
  });

  it('maps SHIPMENT_TRANSITION_ERRORS.RACE to 409 via the shared constant', async () => {
    updateShipmentStatus.mockRejectedValue(new Error(SHIPMENT_TRANSITION_ERRORS.RACE));
    const request = putRequest({ status: 'shipped' });
    const { PUT } = await import('../[id]');

    const response = await PUT({ request, params: { id: '1' }, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toBe(SHIPMENT_TRANSITION_ERRORS.RACE);
  });

  it('hides internal failures behind a generic Spanish 500', async () => {
    updateShipmentStatus.mockRejectedValue(new Error('connection terminated unexpectedly'));
    const request = putRequest({ status: 'shipped' });
    const { PUT } = await import('../[id]');

    const response = await PUT({ request, params: { id: '1' }, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).not.toContain('connection terminated');
  });
});
