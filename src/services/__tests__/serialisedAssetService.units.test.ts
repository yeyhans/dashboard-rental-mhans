import { afterEach, describe, expect, it, vi } from 'vitest';

import { InventoryError, UNIT_ERRORS } from '../../lib/inventoryUnits';
import { LOCATION_ERRORS } from '../../lib/warehouseLocations';
import { allCallArgs, callArgs, sharedDouble as db } from './supabaseDouble';

vi.mock('../../lib/supabase', async () => {
  const { sharedDouble } = await import('./supabaseDouble');
  return { supabaseAdmin: sharedDouble.client };
});

const { SerialisedAssetService } = await import('../serialisedAssetService');

/**
 * Unit editing, archiving, bulk intake and the per-product unit list (migration 0021). Written
 * against the 0021 contract; the migration has not been applied to any database yet.
 */
const unitRow = {
  id: 5,
  product_id: 42,
  asset_tag: 'MH-00005',
  serial_number: 'SN-5',
  condition: 'operational',
  wear: 'used',
  location: 'N-E1 · Estante 1',
  location_id: 'loc-1',
  kit_code: null,
  notes: null,
  row_version: 4,
  created_at: '2026-10-14T00:00:00Z',
  updated_at: '2026-10-14T00:00:00Z',
};

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

afterEach(() => {
  db.reset();
  vi.restoreAllMocks();
});

describe('SerialisedAssetService.updateAsset', () => {
  it('updates only the sanitized fields, guarded by id AND the expected row_version', async () => {
    db.queue('serialised_assets', { data: { ...unitRow, condition: 'maintenance', row_version: 5 }, error: null });

    const unit = await SerialisedAssetService.updateAsset(5, { condition: 'maintenance', asset_tag: 'MH-99999' }, 4);

    const [update] = db.buildersFor('serialised_assets');
    expect(callArgs(update, 'update')).toEqual([{ condition: 'maintenance' }]);
    expect(allCallArgs(update, 'eq')).toEqual([
      ['id', 5],
      ['row_version', 4],
    ]);
    expect(unit.row_version).toBe(5);
  });

  it('answers 409 CONFLICT when the row exists but its version moved on', async () => {
    db.queue('serialised_assets', { data: null, error: null }, { data: { id: 5 }, error: null });

    await expectInventoryError(SerialisedAssetService.updateAsset(5, { notes: 'x' }, 4), 409, UNIT_ERRORS.CONFLICT);
  });

  it('answers 404 when the unit does not exist', async () => {
    db.queue('serialised_assets', { data: null, error: null }, { data: null, error: null });

    await expectInventoryError(SerialisedAssetService.updateAsset(5, { notes: 'x' }, 4), 404, UNIT_ERRORS.NOT_FOUND);
  });

  it('rejects a missing row version and a bad id before touching the database', async () => {
    await expectInventoryError(SerialisedAssetService.updateAsset(5, { notes: 'x' }, 0), 400, UNIT_ERRORS.ROW_VERSION_REQUIRED);
    await expectInventoryError(SerialisedAssetService.updateAsset(0, { notes: 'x' }, 1), 400, UNIT_ERRORS.INVALID_ID);
    expect(db.from).not.toHaveBeenCalled();
  });

  it('maps a serial unique violation to a 409 the operator can act on', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    db.queue('serialised_assets', {
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint "serialised_assets_serial_number_lower_key"' },
    });

    await expectInventoryError(SerialisedAssetService.updateAsset(5, { serial_number: 'SN-1' }, 4), 409, UNIT_ERRORS.SERIAL_TAKEN);
  });
});

describe('SerialisedAssetService.archiveAsset', () => {
  it('sets condition to retired and never deletes', async () => {
    db.queue('asset_current_state', { data: null, error: null });
    db.queue('serialised_assets', { data: { ...unitRow, condition: 'retired', row_version: 5 }, error: null });

    const unit = await SerialisedAssetService.archiveAsset(5, 4);

    const [update] = db.buildersFor('serialised_assets');
    expect(callArgs(update, 'update')).toEqual([{ condition: 'retired' }]);
    expect(allCallArgs(update, 'eq')).toEqual([
      ['id', 5],
      ['row_version', 4],
    ]);
    expect(callArgs(update, 'delete')).toBeUndefined();
    expect(unit.condition).toBe('retired');
  });

  it('refuses to archive a unit that is out on a rental', async () => {
    db.queue('asset_current_state', { data: { asset_id: 5, direction: 'checkout', order_id: 900 }, error: null });

    await expectInventoryError(SerialisedAssetService.archiveAsset(5, 4), 409, UNIT_ERRORS.IN_RENTAL);
    expect(db.buildersFor('serialised_assets')).toHaveLength(0);
  });

  it('answers 409 when the version moved on', async () => {
    db.queue('asset_current_state', { data: null, error: null });
    db.queue('serialised_assets', { data: null, error: null }, { data: { id: 5 }, error: null });

    await expectInventoryError(SerialisedAssetService.archiveAsset(5, 4), 409, UNIT_ERRORS.CONFLICT);
  });
});

describe('SerialisedAssetService.bulkCreateAssets', () => {
  const location = { id: 'loc-1', code: 'N-E1', name: 'Estante 1', is_active: true };

  it('inserts consecutive tags in one statement with the location label the trigger would write', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    db.queue('products', { data: { id: 42 }, error: null });
    db.queue('warehouse_locations', { data: location, error: null });
    db.queue(
      'serialised_assets',
      { data: { asset_tag: 'MH-00041' }, error: null },
      { data: [], error: null },
      { data: [{ id: 1 }, { id: 2 }], error: null }
    );

    const created = await SerialisedAssetService.bulkCreateAssets(42, 2, {
      wear: 'new',
      condition: 'operational',
      location_id: 'loc-1',
      serial_prefix: 'b10',
    });

    const [, serialCheck, insert] = db.buildersFor('serialised_assets');
    expect(callArgs(serialCheck, 'ilike')).toEqual(['serial_number', 'B10-%']);
    expect(callArgs(insert, 'insert')).toEqual([
      [
        { product_id: 42, asset_tag: 'MH-00042', serial_number: 'B10-00042', condition: 'operational', wear: 'new', location: 'N-E1 · Estante 1', location_id: 'loc-1', kit_code: null, notes: null },
        { product_id: 42, asset_tag: 'MH-00043', serial_number: 'B10-00043', condition: 'operational', wear: 'new', location: 'N-E1 · Estante 1', location_id: 'loc-1', kit_code: null, notes: null },
      ],
    ]);
    expect(created).toHaveLength(2);
  });

  it('accepts a free-text location when no location_id is given', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    db.queue('products', { data: { id: 42 }, error: null });
    db.queue('serialised_assets', { data: null, error: null }, { data: [], error: null }, { data: [{ id: 1 }], error: null });

    await SerialisedAssetService.bulkCreateAssets(42, 1, { location: '  Bodega  ' });

    const [, , insert] = db.buildersFor('serialised_assets');
    const rows = callArgs(insert, 'insert')?.[0] as Array<Record<string, unknown>>;
    expect(rows[0]).toMatchObject({ asset_tag: 'MH-00001', serial_number: 'MH-00001', location: 'Bodega', location_id: null, wear: 'used', condition: 'operational' });
  });

  it('refuses the batch when any generated serial already exists (case-insensitive)', async () => {
    db.queue('products', { data: { id: 42 }, error: null });
    db.queue('serialised_assets', { data: { asset_tag: 'MH-00041' }, error: null }, { data: [{ serial_number: 'b10-00043 ' }], error: null });

    await expectInventoryError(
      SerialisedAssetService.bulkCreateAssets(42, 2, { location: 'Bodega', serial_prefix: 'B10' }),
      409,
      `${UNIT_ERRORS.BULK_SERIAL_TAKEN}: B10-00043`
    );
    expect(db.buildersFor('serialised_assets')).toHaveLength(2);
  });

  it('answers 404 for an unknown product and 400 without any location', async () => {
    db.queue('products', { data: null, error: null });
    await expectInventoryError(SerialisedAssetService.bulkCreateAssets(42, 1, { location: 'Bodega' }), 404, UNIT_ERRORS.PRODUCT_NOT_FOUND);

    await expectInventoryError(SerialisedAssetService.bulkCreateAssets(42, 1, {}), 400, UNIT_ERRORS.LOCATION_REQUIRED);
  });

  it('refuses an inactive or unknown warehouse location', async () => {
    db.queue('products', { data: { id: 42 }, error: null }, { data: { id: 42 }, error: null });
    db.queue('warehouse_locations', { data: { ...location, is_active: false }, error: null }, { data: null, error: null });

    await expectInventoryError(SerialisedAssetService.bulkCreateAssets(42, 1, { location_id: 'loc-1' }), 400, LOCATION_ERRORS.INACTIVE);
    await expectInventoryError(SerialisedAssetService.bulkCreateAssets(42, 1, { location_id: 'loc-1' }), 404, LOCATION_ERRORS.NOT_FOUND);
  });

  it('refuses retired and unknown default conditions', async () => {
    await expectInventoryError(SerialisedAssetService.bulkCreateAssets(42, 1, { location: 'B', condition: 'retired' as never }), 400, UNIT_ERRORS.USE_ARCHIVE);
    await expectInventoryError(SerialisedAssetService.bulkCreateAssets(42, 1, { location: 'B', wear: 'mint' as never }), 400, UNIT_ERRORS.INVALID_WEAR);
  });

  it('maps a tag collision from a concurrent intake to a retryable 409', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    db.queue('products', { data: { id: 42 }, error: null });
    db.queue(
      'serialised_assets',
      { data: null, error: null },
      { data: [], error: null },
      { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "serialised_assets_asset_tag_key"' } }
    );

    await expectInventoryError(SerialisedAssetService.bulkCreateAssets(42, 1, { location: 'Bodega' }), 409, UNIT_ERRORS.TAG_RACE);
  });
});

describe('SerialisedAssetService.listByProduct', () => {
  it('derives the display status from asset_current_state and flattens the location', async () => {
    db.queue('serialised_assets', {
      data: [
        { ...unitRow, warehouse_locations: { id: 'loc-1', code: 'N-E1', name: 'Estante 1', kind: 'shelf' } },
        { ...unitRow, id: 6, asset_tag: 'MH-00006', condition: 'damaged', location_id: null, location: 'Bodega', warehouse_locations: null },
      ],
      error: null,
    });
    db.queue('asset_current_state', { data: [{ asset_id: 5, order_id: 900, direction: 'checkout' }], error: null });

    const units = await SerialisedAssetService.listByProduct(42);

    const [list] = db.buildersFor('serialised_assets');
    expect(callArgs(list, 'eq')).toEqual(['product_id', 42]);
    const [state] = db.buildersFor('asset_current_state');
    expect(callArgs(state, 'in')).toEqual(['asset_id', [5, 6]]);
    expect(allCallArgs(state, 'eq')).toEqual([['direction', 'checkout']]);

    expect(units[0]).toMatchObject({ id: 5, status: 'in_rental', open_order_id: 900, location_detail: { id: 'loc-1', code: 'N-E1', name: 'Estante 1', kind: 'shelf' } });
    expect(units[0]).not.toHaveProperty('warehouse_locations');
    expect(units[1]).toMatchObject({ id: 6, status: 'damaged', open_order_id: null, location_detail: null });
  });

  it('skips the state query for a product with no units', async () => {
    db.queue('serialised_assets', { data: [], error: null });

    expect(await SerialisedAssetService.listByProduct(42)).toEqual([]);
    expect(db.buildersFor('asset_current_state')).toHaveLength(0);
  });
});
