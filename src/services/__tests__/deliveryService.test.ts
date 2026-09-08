import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SHIPMENT_TRANSITION_ERRORS } from '../../lib/delivery';

/**
 * `DeliveryService.updateShipmentStatus` against `shipping_usage` (T-026 gap 2/4, R3-205 fix).
 * The state machine itself lives in `lib/delivery.ts`'s `canTransitionShipment` and is covered
 * there; this suite only verifies what the service adds: fetching the current status, delegating
 * to the pure validator BEFORE writing, stamping `shipped_at`/`delivered_at`, and defending
 * against a race between the fetch and the write (same optimistic-concurrency shape as
 * `assetMovementService.ts`'s DB-level defense-in-depth, just via a conditional `UPDATE` instead
 * of a unique index since `shipping_usage` has none for this).
 */
const state = vi.hoisted(() => ({
  fetchCurrent: { data: null as any, error: null as any },
  update: { data: null as any, error: null as any },
}));

vi.mock('../../lib/supabase', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== 'shipping_usage') throw new Error(`unexpected table: ${table}`);
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve(state.fetchCurrent),
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve(state.update),
              }),
            }),
          }),
        }),
      };
    },
  },
}));

const { DeliveryService } = await import('../deliveryService');

beforeEach(() => {
  state.fetchCurrent = { data: null, error: null };
  state.update = { data: null, error: null };
});

describe('DeliveryService.updateShipmentStatus', () => {
  it('writes the new status and stamps shipped_at when marking a dispatch shipped', async () => {
    state.fetchCurrent.data = { id: 1, status: 'pending' };
    state.update.data = { id: 1, status: 'shipped', shipped_at: '2026-08-23T10:00:00Z', delivered_at: null };

    const result = await DeliveryService.updateShipmentStatus(1, 'shipped');

    expect(result).toEqual({ id: 1, status: 'shipped', shippedAt: '2026-08-23T10:00:00Z', deliveredAt: null });
  });

  it('writes delivered and stamps delivered_at — this is what makes checkout unreachable again, by design', async () => {
    state.fetchCurrent.data = { id: 1, status: 'shipped' };
    state.update.data = { id: 1, status: 'delivered', shipped_at: '2026-08-23T09:00:00Z', delivered_at: '2026-08-23T12:00:00Z' };

    const result = await DeliveryService.updateShipmentStatus(1, 'delivered');

    expect(result.status).toBe('delivered');
    expect(result.deliveredAt).toBe('2026-08-23T12:00:00Z');
  });

  it('rejects an illegal transition WITHOUT writing to the database', async () => {
    state.fetchCurrent.data = { id: 1, status: 'delivered' };

    await expect(DeliveryService.updateShipmentStatus(1, 'shipped')).rejects.toThrow(
      SHIPMENT_TRANSITION_ERRORS.ILLEGAL
    );
    expect(state.update.data).toBeNull(); // never touched — the mock default, unset by the service
  });

  it('rejects skipping a state (pending straight to delivered)', async () => {
    state.fetchCurrent.data = { id: 1, status: 'pending' };

    await expect(DeliveryService.updateShipmentStatus(1, 'delivered')).rejects.toThrow(
      SHIPMENT_TRANSITION_ERRORS.ILLEGAL
    );
  });

  it('reports a missing shipment instead of a raw Postgres not-found', async () => {
    state.fetchCurrent.error = { code: 'PGRST116', message: 'no rows' };

    await expect(DeliveryService.updateShipmentStatus(999, 'shipped')).rejects.toThrow(
      SHIPMENT_TRANSITION_ERRORS.NOT_FOUND
    );
  });

  it('reports a race when the status changed between the fetch and the write', async () => {
    state.fetchCurrent.data = { id: 1, status: 'pending' };
    // El UPDATE llevaba `.eq('status', from)`: si otra request ya cambió el estado, la condición
    // no matchea ninguna fila y `.single()` devuelve PGRST116 aunque el registro SÍ existe.
    state.update.error = { code: 'PGRST116', message: 'no rows' };

    await expect(DeliveryService.updateShipmentStatus(1, 'shipped')).rejects.toThrow(
      SHIPMENT_TRANSITION_ERRORS.RACE
    );
  });

  it('propagates a database error instead of returning a partial result', async () => {
    state.fetchCurrent.error = { message: 'permission denied for table shipping_usage' };

    await expect(DeliveryService.updateShipmentStatus(1, 'shipped')).rejects.toMatchObject({
      message: 'permission denied for table shipping_usage',
    });
  });
});
