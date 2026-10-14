import { afterEach, describe, expect, it, vi } from 'vitest';

import { InventoryError } from '../../lib/inventoryUnits';
import { LOCATION_ERRORS } from '../../lib/warehouseLocations';
import { allCallArgs, callArgs, sharedDouble as db } from './supabaseDouble';

vi.mock('../../lib/supabase', async () => {
  const { sharedDouble } = await import('./supabaseDouble');
  return { supabaseAdmin: sharedDouble.client };
});

const { WarehouseLocationService } = await import('../warehouseLocationService');

const base = {
  parent_id: null,
  wall: 'N',
  pos_x: 1,
  pos_y: 0.3,
  width: 1,
  depth: 0.4,
  height: 2,
  level_index: null,
  rotation_deg: 0,
  is_active: true,
  row_version: 1,
  created_at: '2026-10-14T00:00:00Z',
  updated_at: '2026-10-14T00:00:00Z',
  updated_by: null,
};
const rug = { ...base, id: 'rug', code: 'C-ALF', name: 'Alfombra central', kind: 'rug', wall: 'C', pos_x: 2.5, pos_y: 2.5, width: 1.6, depth: 1.2, height: null };
const shelf = { ...base, id: 'shelf-1', code: 'N-E1', name: 'Estante 1', kind: 'shelf' };

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

describe('WarehouseLocationService.list / tree', () => {
  it('lists active locations by code unless inactive ones are requested', async () => {
    db.queue('warehouse_locations', { data: [rug, shelf], error: null }, { data: [rug], error: null });

    expect(await WarehouseLocationService.list()).toHaveLength(2);
    await WarehouseLocationService.list({ includeInactive: true });

    const [active, all] = db.buildersFor('warehouse_locations');
    expect(allCallArgs(active, 'eq')).toEqual([['is_active', true]]);
    expect(callArgs(active, 'order')).toEqual(['code', { ascending: true }]);
    expect(allCallArgs(all, 'eq')).toEqual([]);
  });

  it('builds the tree from the active list', async () => {
    db.queue('warehouse_locations', { data: [shelf, rug, { ...base, id: 'lv', code: 'N-E1-N1', name: 'Nivel 1', kind: 'level', parent_id: 'shelf-1' }], error: null });

    const tree = await WarehouseLocationService.tree();
    expect(tree.map((node) => node.code)).toEqual(['C-ALF', 'N-E1']);
    expect(tree[1]?.children.map((node) => node.code)).toEqual(['N-E1-N1']);
  });
});

describe('WarehouseLocationService.create', () => {
  it('validates against every location, then inserts with the acting admin', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    db.queue('warehouse_locations', { data: [rug, shelf], error: null }, { data: { ...shelf, id: 'new', code: 'N-E2' }, error: null });

    const result = await WarehouseLocationService.create({ code: 'n-e2', name: 'Estante 2', kind: 'shelf', wall: 'N', pos_x: 3, pos_y: 0.3, width: 1, depth: 0.4 }, 'auth-uuid');

    const [, insert] = db.buildersFor('warehouse_locations');
    expect(callArgs(insert, 'insert')).toEqual([
      { code: 'N-E2', name: 'Estante 2', kind: 'shelf', parent_id: null, wall: 'N', pos_x: 3, pos_y: 0.3, width: 1, depth: 0.4, height: null, level_index: null, rotation_deg: 0, updated_by: 'auth-uuid' },
    ]);
    expect(result.location.code).toBe('N-E2');
    expect(result.warnings).toEqual([]);
  });

  it('turns a validation failure into an InventoryError without inserting', async () => {
    db.queue('warehouse_locations', { data: [rug, shelf], error: null });

    await expectInventoryError(WarehouseLocationService.create({ code: 'N-E1', name: 'x', kind: 'shelf' }, 'u'), 409, LOCATION_ERRORS.CODE_TAKEN);
    expect(db.buildersFor('warehouse_locations')).toHaveLength(1);
  });

  it('maps a racing duplicate code (23505) to 409', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    db.queue('warehouse_locations', { data: [], error: null }, { data: null, error: { code: '23505', message: 'warehouse_locations_code_key' } });

    await expectInventoryError(WarehouseLocationService.create({ code: 'N-E9', name: 'x', kind: 'shelf' }, 'u'), 409, LOCATION_ERRORS.CODE_TAKEN);
  });
});

describe('WarehouseLocationService.update', () => {
  it('merges the patch over the stored row and updates under the expected version', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    db.queue('warehouse_locations', { data: [rug, shelf], error: null }, { data: { ...shelf, name: 'Estante norte', row_version: 2 }, error: null });

    const result = await WarehouseLocationService.update('shelf-1', { name: 'Estante norte' }, 1, 'auth-uuid');

    const [, update] = db.buildersFor('warehouse_locations');
    expect(callArgs(update, 'update')?.[0]).toMatchObject({ code: 'N-E1', name: 'Estante norte', kind: 'shelf', updated_by: 'auth-uuid' });
    expect(allCallArgs(update, 'eq')).toEqual([
      ['id', 'shelf-1'],
      ['row_version', 1],
    ]);
    expect(result.location.row_version).toBe(2);
  });

  it('answers 404 for an unknown id and 409 when the version moved on', async () => {
    db.queue('warehouse_locations', { data: [rug], error: null });
    await expectInventoryError(WarehouseLocationService.update('ghost', { name: 'x' }, 1, 'u'), 404, LOCATION_ERRORS.NOT_FOUND);

    db.queue('warehouse_locations', { data: [rug, shelf], error: null }, { data: null, error: null });
    await expectInventoryError(WarehouseLocationService.update('shelf-1', { name: 'x' }, 1, 'u'), 409, LOCATION_ERRORS.CONFLICT);
  });

  it('requires a row version', async () => {
    await expectInventoryError(WarehouseLocationService.update('shelf-1', { name: 'x' }, 0, 'u'), 400, LOCATION_ERRORS.ROW_VERSION_REQUIRED);
  });
});

describe('WarehouseLocationService.deactivate', () => {
  it('sets is_active false under the expected version', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    db.queue('warehouse_locations', { data: [rug, shelf], error: null }, { data: { ...shelf, is_active: false, row_version: 2 }, error: null });
    db.queue('serialised_assets', { data: null, error: null, count: 0 });

    const location = await WarehouseLocationService.deactivate('shelf-1', 1, 'auth-uuid');

    const [, update] = db.buildersFor('warehouse_locations');
    expect(callArgs(update, 'update')).toEqual([{ is_active: false, updated_by: 'auth-uuid' }]);
    expect(location.is_active).toBe(false);
    const [count] = db.buildersFor('serialised_assets');
    expect(allCallArgs(count, 'eq')).toEqual([['location_id', 'shelf-1']]);
    expect(callArgs(count, 'neq')).toEqual(['condition', 'retired']);
  });

  it('refuses while active children hang from it', async () => {
    db.queue('warehouse_locations', { data: [shelf, { ...base, id: 'lv', code: 'N-E1-N1', name: 'Nivel 1', kind: 'level', parent_id: 'shelf-1' }], error: null });

    await expectInventoryError(WarehouseLocationService.deactivate('shelf-1', 1, 'u'), 409, LOCATION_ERRORS.HAS_CHILDREN);
  });

  it('refuses while units are stored there', async () => {
    db.queue('warehouse_locations', { data: [shelf], error: null });
    db.queue('serialised_assets', { data: null, error: null, count: 3 });

    await expectInventoryError(WarehouseLocationService.deactivate('shelf-1', 1, 'u'), 409, `${LOCATION_ERRORS.HAS_UNITS} (3)`);
  });
});
