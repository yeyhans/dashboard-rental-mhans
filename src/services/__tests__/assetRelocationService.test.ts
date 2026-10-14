import { afterEach, describe, expect, it, vi } from 'vitest';

import { InventoryError, UNIT_ERRORS } from '../../lib/inventoryUnits';
import { LOCATION_ERRORS } from '../../lib/warehouseLocations';
import { allCallArgs, callArgs, sharedDouble as db } from './supabaseDouble';

vi.mock('../../lib/supabase', async () => {
  const { sharedDouble } = await import('./supabaseDouble');
  return { supabaseAdmin: sharedDouble.client };
});

const { AssetRelocationService } = await import('../assetRelocationService');

/**
 * Relocation (0021): inserting into `asset_relocations` IS the move. The AFTER INSERT trigger
 * updates `serialised_assets.location_id` only while the unit is still at `from_location_id`, and
 * raises PT409 otherwise, so the service never updates `location_id` itself.
 */
const unit = { id: 5, location_id: 'loc-a', row_version: 3, condition: 'operational' };
const target = { id: 'loc-b', code: 'S-E1', name: 'Estante sur', is_active: true };

async function expectInventoryError(promise: Promise<unknown>, status: number, message: string) {
  try {
    await promise;
    expect.unreachable('expected an InventoryError');
  } catch (error) {
    expect(error).toBeInstanceOf(InventoryError);
    expect((error as InventoryError).status).toBe(status);
    expect((error as InventoryError).message).toBe(message);
  }
}

const input = { assetId: 5, toLocationId: 'loc-b', movedByUserId: 'auth-uuid', source: 'dashboard' as const, expectedRowVersion: 3 };

afterEach(() => {
  db.reset();
  vi.restoreAllMocks();
});

describe('AssetRelocationService.relocateAsset', () => {
  it('inserts one relocation from the current location and returns the moved unit', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    db.queue('serialised_assets', { data: unit, error: null }, { data: { ...unit, location_id: 'loc-b', row_version: 4 }, error: null });
    db.queue('warehouse_locations', { data: target, error: null });
    db.queue('asset_relocations', { data: { id: 77 }, error: null });

    const result = await AssetRelocationService.relocateAsset({ ...input, notes: '  al estante sur ' });

    const [insert] = db.buildersFor('asset_relocations');
    expect(callArgs(insert, 'insert')).toEqual([
      { asset_id: 5, from_location_id: 'loc-a', to_location_id: 'loc-b', moved_by_admin_id: 'auth-uuid', source: 'dashboard', notes: 'al estante sur' },
    ]);
    // Never writes location_id directly: the only serialised_assets calls are reads.
    for (const builder of db.buildersFor('serialised_assets')) {
      expect(callArgs(builder, 'update')).toBeUndefined();
    }
    expect(result.relocation.id).toBe(77);
    expect(result.unit.location_id).toBe('loc-b');
  });

  it('sends a null from_location_id for a unit that only has legacy text', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    db.queue('serialised_assets', { data: { ...unit, location_id: null }, error: null }, { data: unit, error: null });
    db.queue('warehouse_locations', { data: target, error: null });
    db.queue('asset_relocations', { data: { id: 1 }, error: null });

    await AssetRelocationService.relocateAsset(input);

    const [insert] = db.buildersFor('asset_relocations');
    expect((callArgs(insert, 'insert')?.[0] as Record<string, unknown>).from_location_id).toBeNull();
  });

  it('answers 409 when the unit version moved on since the operator read it', async () => {
    db.queue('serialised_assets', { data: { ...unit, row_version: 4 }, error: null });

    await expectInventoryError(AssetRelocationService.relocateAsset(input), 409, UNIT_ERRORS.CONFLICT);
    expect(db.buildersFor('asset_relocations')).toHaveLength(0);
  });

  it('maps the trigger PT409 (another move won the race) to the same 409', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    db.queue('serialised_assets', { data: unit, error: null });
    db.queue('warehouse_locations', { data: target, error: null });
    db.queue('asset_relocations', { data: null, error: { code: 'PT409', message: 'stale from_location_id' } });

    await expectInventoryError(AssetRelocationService.relocateAsset(input), 409, UNIT_ERRORS.CONFLICT);
  });

  it('refuses a move to where the unit already is', async () => {
    db.queue('serialised_assets', { data: { ...unit, location_id: 'loc-b' }, error: null });

    await expectInventoryError(AssetRelocationService.relocateAsset(input), 400, LOCATION_ERRORS.SAME_LOCATION);
  });

  it('refuses unknown units, unknown or inactive targets, and archived units', async () => {
    db.queue('serialised_assets', { data: null, error: null });
    await expectInventoryError(AssetRelocationService.relocateAsset(input), 404, UNIT_ERRORS.NOT_FOUND);

    db.queue('serialised_assets', { data: unit, error: null }, { data: unit, error: null });
    db.queue('warehouse_locations', { data: null, error: null }, { data: { ...target, is_active: false }, error: null });
    await expectInventoryError(AssetRelocationService.relocateAsset(input), 404, LOCATION_ERRORS.NOT_FOUND);
    await expectInventoryError(AssetRelocationService.relocateAsset(input), 400, LOCATION_ERRORS.INACTIVE);

    db.queue('serialised_assets', { data: { ...unit, condition: 'retired' }, error: null });
    await expectInventoryError(AssetRelocationService.relocateAsset(input), 409, UNIT_ERRORS.ARCHIVED);
  });

  it('validates its inputs before any query', async () => {
    await expectInventoryError(AssetRelocationService.relocateAsset({ ...input, assetId: 0 }), 400, UNIT_ERRORS.INVALID_ID);
    await expectInventoryError(AssetRelocationService.relocateAsset({ ...input, toLocationId: '' }), 400, LOCATION_ERRORS.TARGET_REQUIRED);
    await expectInventoryError(AssetRelocationService.relocateAsset({ ...input, expectedRowVersion: 0 }), 400, UNIT_ERRORS.ROW_VERSION_REQUIRED);
    await expectInventoryError(AssetRelocationService.relocateAsset({ ...input, source: 'api' as never }), 400, LOCATION_ERRORS.SOURCE_INVALID);
    expect(db.from).not.toHaveBeenCalled();
  });
});

describe('AssetRelocationService.listForAsset', () => {
  it('returns the newest moves first', async () => {
    db.queue('asset_relocations', { data: [{ id: 2 }, { id: 1 }], error: null });

    const rows = await AssetRelocationService.listForAsset(5);

    const [list] = db.buildersFor('asset_relocations');
    expect(allCallArgs(list, 'eq')).toEqual([['asset_id', 5]]);
    expect(callArgs(list, 'order')).toEqual(['moved_at', { ascending: false }]);
    expect(rows).toHaveLength(2);
  });
});
