import { afterEach, describe, expect, it, vi } from 'vitest';

import { INCIDENT_ERRORS } from '../../lib/assetMovements';
import { callArgs, sharedDouble as db } from './supabaseDouble';

vi.mock('../../lib/supabase', async () => {
  const { sharedDouble } = await import('./supabaseDouble');
  return { supabaseAdmin: sharedDouble.client };
});

const { AssetMovementService } = await import('../assetMovementService');

/**
 * `asset_movements.incident_type` (0021): a check-in may carry one of the canon's incident
 * types. The existing transition rules are unchanged; see `assetMovementService.test.ts`.
 */
const openCheckout = [{ id: 1, asset_id: 5, order_id: 10, direction: 'checkout', checked_at: '2026-10-10T10:00:00Z' }];

afterEach(() => {
  db.reset();
  vi.restoreAllMocks();
});

describe('AssetMovementService.recordMovement incident_type', () => {
  it('stores the incident on a checkin', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    db.queue('asset_movements', { data: openCheckout, error: null }, { data: { id: 2, incident_type: 'moisture' }, error: null });

    await AssetMovementService.recordMovement({ asset_id: 5, order_id: 10, direction: 'checkin', incident_type: 'moisture', checked_by_admin_id: 7 });

    const [, insert] = db.buildersFor('asset_movements');
    expect(callArgs(insert, 'insert')?.[0]).toMatchObject({ direction: 'checkin', incident_type: 'moisture' });
  });

  it('omits the column entirely when there is no incident, so writes keep working before 0021 is applied', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    db.queue('asset_movements', { data: openCheckout, error: null }, { data: { id: 2 }, error: null });

    await AssetMovementService.recordMovement({ asset_id: 5, order_id: 10, direction: 'checkin' });

    const [, insert] = db.buildersFor('asset_movements');
    expect(callArgs(insert, 'insert')?.[0]).not.toHaveProperty('incident_type');
  });

  it('refuses an incident on a checkout and an unknown incident before any query', async () => {
    await expect(
      AssetMovementService.recordMovement({ asset_id: 5, order_id: 10, direction: 'checkout', incident_type: 'moisture' })
    ).rejects.toThrow(INCIDENT_ERRORS.CHECKOUT_INCIDENT);
    await expect(
      AssetMovementService.recordMovement({ asset_id: 5, order_id: 10, direction: 'checkin', incident_type: 'fire' as never })
    ).rejects.toThrow(INCIDENT_ERRORS.INVALID);
    expect(db.from).not.toHaveBeenCalled();
  });
});
