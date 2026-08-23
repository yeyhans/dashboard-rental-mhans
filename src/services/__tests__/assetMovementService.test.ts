import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `assetMovementService.ts` against `asset_movements` (T-026 gap 1/4). The migration
 * (`0006_t026_schema_gaps.sql`) has not been applied to any database yet, so this suite mocks
 * `supabaseAdmin` end to end — same pattern as `shippingService.test.ts`. The transition rule
 * itself lives in `lib/assetMovements.ts` and is covered there; this suite only verifies what the
 * service adds: fetching an asset's history, calling the pure validator, and inserting.
 */
const state = vi.hoisted(() => ({
  history: { data: [] as any[] | null, error: null as any },
  insert: { data: null as any, error: null as any },
}));

vi.mock('../../lib/supabase', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== 'asset_movements') throw new Error(`unexpected table: ${table}`);
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve(state.history),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve(state.insert),
          }),
        }),
      };
    },
  },
}));

const { AssetMovementService } = await import('../assetMovementService');

beforeEach(() => {
  state.history = { data: [], error: null };
  state.insert = { data: null, error: null };
});

describe('AssetMovementService.recordMovement', () => {
  it('rejects a checkout when the asset already has an open checkout', async () => {
    state.history.data = [
      { asset_id: 1, direction: 'checkout', checked_at: '2026-08-01T10:00:00Z' },
    ];

    await expect(
      AssetMovementService.recordMovement({ asset_id: 1, order_id: 10, direction: 'checkout' })
    ).rejects.toThrow('El equipo ya tiene un checkout abierto, debe hacer check-in primero');
  });

  it('rejects a checkin when the asset has no open checkout', async () => {
    state.history.data = [];

    await expect(
      AssetMovementService.recordMovement({ asset_id: 1, order_id: 10, direction: 'checkin' })
    ).rejects.toThrow('El equipo no tiene un checkout abierto para hacer check-in');
  });

  it('inserts the movement when the transition is valid', async () => {
    state.history.data = [];
    state.insert.data = {
      id: 5,
      asset_id: 1,
      order_id: 10,
      direction: 'checkout',
      condition_notes: null,
      checked_by_admin_id: 2,
      checked_at: '2026-08-20T10:00:00Z',
    };

    const result = await AssetMovementService.recordMovement({
      asset_id: 1,
      order_id: 10,
      direction: 'checkout',
      checked_by_admin_id: 2,
    });

    expect(result.id).toBe(5);
    expect(result.direction).toBe('checkout');
  });

  it('rejects an invalid direction before querying the database', async () => {
    await expect(
      AssetMovementService.recordMovement({ asset_id: 1, order_id: 10, direction: 'invalid' as any })
    ).rejects.toThrow('Dirección inválida');
  });

  it('propagates a database error instead of returning a partial result', async () => {
    state.history.error = { message: 'permission denied for table asset_movements' };

    await expect(
      AssetMovementService.recordMovement({ asset_id: 1, order_id: 10, direction: 'checkout' })
    ).rejects.toMatchObject({ message: 'permission denied for table asset_movements' });
  });
});
