import { describe, expect, it } from 'vitest';

import type { WarehouseLocation } from '../../types/inventory';
import {
  LOCATION_ERRORS,
  buildLocationTree,
  describeLocation,
  normalizeLocationCode,
  parseLocationDraft,
  validateLocation,
  type LocationDraft,
} from '../warehouseLocations';

/**
 * Pure validation for `warehouse_locations` (migration 0021). The database enforces the same
 * rules with CHECKs and the `warehouse_locations_validate_parent` trigger; this module exists so
 * the operator gets a Spanish sentence instead of a constraint name.
 */
function loc(overrides: Partial<WarehouseLocation>): WarehouseLocation {
  return {
    id: 'id-x',
    code: 'N-E1',
    name: 'Estante 1',
    kind: 'shelf',
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
    ...overrides,
  };
}

function draft(overrides: Partial<LocationDraft>): LocationDraft {
  return {
    code: 'N-E2',
    name: 'Estante 2',
    kind: 'shelf',
    parent_id: null,
    wall: 'N',
    pos_x: 3,
    pos_y: 0.3,
    width: 1,
    depth: 0.4,
    height: 2,
    level_index: null,
    rotation_deg: 0,
    ...overrides,
  };
}

const rug = loc({ id: 'rug', code: 'C-ALF', name: 'Alfombra central', kind: 'rug', wall: 'C', pos_x: 2.5, pos_y: 2.5, width: 1.6, depth: 1.2, height: null });
const shelf = loc({ id: 'shelf-1' });
const level = loc({ id: 'level-1', code: 'N-E1-N1', name: 'Nivel 1', kind: 'level', parent_id: 'shelf-1', pos_x: null, pos_y: null, width: null, depth: null, height: null, level_index: 0 });

describe('normalizeLocationCode / describeLocation', () => {
  it('trims and upper-cases a code', () => {
    expect(normalizeLocationCode('  n-e1-n2 ')).toBe('N-E1-N2');
  });

  it('formats the same label the DB trigger writes into serialised_assets.location', () => {
    expect(describeLocation({ code: 'C-ALF', name: 'Alfombra central' })).toBe('C-ALF · Alfombra central');
  });
});

describe('parseLocationDraft', () => {
  it('coerces numeric strings and defaults optional fields', () => {
    const parsed = parseLocationDraft({ code: ' s-e3 ', name: ' Estante 3 ', kind: 'shelf', wall: 'S', pos_x: '1.5', pos_y: '4.7' });
    expect(parsed).toEqual({
      code: 'S-E3',
      name: 'Estante 3',
      kind: 'shelf',
      parent_id: null,
      wall: 'S',
      pos_x: 1.5,
      pos_y: 4.7,
      width: null,
      depth: null,
      height: null,
      level_index: null,
      rotation_deg: 0,
    });
  });

  it('merges a partial patch over a base location', () => {
    const parsed = parseLocationDraft({ name: 'Renombrado' }, shelf);
    expect(parsed.name).toBe('Renombrado');
    expect(parsed.code).toBe('N-E1');
    expect(parsed.width).toBe(1);
  });

  it('keeps garbage numbers as NaN so validation can reject them', () => {
    expect(Number.isNaN(parseLocationDraft({ pos_x: 'abc' }, shelf).pos_x)).toBe(true);
  });
});

describe('validateLocation', () => {
  const all = [rug, shelf, level];

  it('accepts a well-formed shelf', () => {
    expect(validateLocation(draft({}), { all })).toEqual({ ok: true, warnings: [] });
  });

  it('rejects a malformed code', () => {
    expect(validateLocation(draft({ code: 'X-1' }), { all })).toMatchObject({ ok: false, error: LOCATION_ERRORS.CODE_FORMAT, status: 400 });
  });

  it('rejects a duplicate code with 409, ignoring itself on update', () => {
    expect(validateLocation(draft({ code: 'N-E1' }), { all })).toMatchObject({ ok: false, error: LOCATION_ERRORS.CODE_TAKEN, status: 409 });
    expect(validateLocation(draft({ code: 'N-E1', pos_x: 1 }), { all, selfId: 'shelf-1' })).toMatchObject({ ok: true });
  });

  it('rejects an empty name, unknown kind or wall', () => {
    expect(validateLocation(draft({ name: ' ' }), { all })).toMatchObject({ error: LOCATION_ERRORS.NAME_REQUIRED });
    expect(validateLocation(draft({ kind: 'drawer' as never }), { all })).toMatchObject({ error: LOCATION_ERRORS.KIND_INVALID });
    expect(validateLocation(draft({ wall: 'X' as never }), { all })).toMatchObject({ error: LOCATION_ERRORS.WALL_INVALID });
  });

  it('keeps positions inside the 5x5 m room and sizes positive', () => {
    expect(validateLocation(draft({ pos_x: 5.1 }), { all })).toMatchObject({ error: LOCATION_ERRORS.POSITION_RANGE });
    expect(validateLocation(draft({ pos_y: -0.1 }), { all })).toMatchObject({ error: LOCATION_ERRORS.POSITION_RANGE });
    expect(validateLocation(draft({ pos_x: Number.NaN }), { all })).toMatchObject({ error: LOCATION_ERRORS.POSITION_RANGE });
    expect(validateLocation(draft({ width: 0 }), { all })).toMatchObject({ error: LOCATION_ERRORS.SIZE_RANGE });
    expect(validateLocation(draft({ height: 6 }), { all })).toMatchObject({ error: LOCATION_ERRORS.SIZE_RANGE });
  });

  it('rejects a rotation that is not a right angle and a negative level index', () => {
    expect(validateLocation(draft({ rotation_deg: 45 as never }), { all })).toMatchObject({ error: LOCATION_ERRORS.ROTATION_INVALID });
    expect(validateLocation(draft({ kind: 'level', parent_id: 'shelf-1', code: 'N-E1-N2', level_index: -1 }), { all })).toMatchObject({ error: LOCATION_ERRORS.LEVEL_INDEX });
  });

  it('requires a level to hang from a shelf', () => {
    expect(validateLocation(draft({ kind: 'level', code: 'N-E1-N2', parent_id: null }), { all })).toMatchObject({ error: LOCATION_ERRORS.LEVEL_NEEDS_SHELF });
    expect(validateLocation(draft({ kind: 'level', code: 'N-E1-N2', parent_id: 'rug' }), { all })).toMatchObject({ error: LOCATION_ERRORS.LEVEL_NEEDS_SHELF });
    expect(validateLocation(draft({ kind: 'level', code: 'N-E1-N2', parent_id: 'shelf-1', level_index: 1 }), { all })).toMatchObject({ ok: true });
  });

  it('forbids a parent on shelves, floor areas and the rug', () => {
    expect(validateLocation(draft({ parent_id: 'rug' }), { all })).toMatchObject({ error: LOCATION_ERRORS.ROOT_KIND_HAS_PARENT });
    expect(validateLocation(draft({ kind: 'floor', code: 'S-P1', parent_id: 'shelf-1' }), { all })).toMatchObject({ error: LOCATION_ERRORS.ROOT_KIND_HAS_PARENT });
  });

  it('lets a box sit on a shelf, level, floor or rug, or stand alone', () => {
    for (const parentId of ['shelf-1', 'level-1', 'rug', null]) {
      expect(validateLocation(draft({ kind: 'box', code: 'N-C1', parent_id: parentId }), { all })).toMatchObject({ ok: true });
    }
    const box = loc({ id: 'box-1', code: 'N-C9', kind: 'box' });
    expect(validateLocation(draft({ kind: 'box', code: 'N-C1', parent_id: 'box-1' }), { all: [...all, box] })).toMatchObject({ error: LOCATION_ERRORS.BOX_PARENT_KIND });
  });

  it('rejects a missing or inactive parent and a self parent', () => {
    expect(validateLocation(draft({ kind: 'box', code: 'N-C1', parent_id: 'ghost' }), { all })).toMatchObject({ error: LOCATION_ERRORS.PARENT_NOT_FOUND });
    const closed = loc({ id: 'shelf-off', code: 'E-E1', is_active: false });
    expect(validateLocation(draft({ kind: 'box', code: 'N-C1', parent_id: 'shelf-off' }), { all: [...all, closed] })).toMatchObject({ error: LOCATION_ERRORS.PARENT_INACTIVE });
    expect(validateLocation(draft({ kind: 'box', code: 'N-C1', parent_id: 'box-1' }), { all: [...all, loc({ id: 'box-1', code: 'N-C1', kind: 'box' })], selfId: 'box-1' })).toMatchObject({ error: LOCATION_ERRORS.SELF_PARENT });
  });

  it('allows only one active rug', () => {
    expect(validateLocation(draft({ kind: 'rug', code: 'C-ALF2', wall: 'C', pos_x: 2.5, pos_y: 2.5 }), { all })).toMatchObject({ error: LOCATION_ERRORS.RUG_UNIQUE, status: 409 });
    expect(validateLocation(draft({ kind: 'rug', code: 'C-ALF', name: 'Alfombra', wall: 'C', pos_x: 2.5, pos_y: 2.5, width: 1.6, depth: 1.2 }), { all, selfId: 'rug' })).toMatchObject({ ok: true });
  });

  it('refuses to change the kind of a location that has children (DB trigger rule)', () => {
    expect(validateLocation(draft({ code: 'N-E1', kind: 'floor' }), { all, selfId: 'shelf-1' })).toMatchObject({ error: LOCATION_ERRORS.KIND_LOCKED });
  });

  it('warns, without blocking, when a footprint leaves the room or overlaps another root item', () => {
    const outside = validateLocation(draft({ pos_x: 4.8, width: 1 }), { all });
    expect(outside).toMatchObject({ ok: true });
    expect((outside as { warnings: string[] }).warnings).toContain(LOCATION_ERRORS.WARN_OUTSIDE_ROOM);

    const overlapping = validateLocation(draft({ pos_x: 1.2 }), { all });
    expect(overlapping).toMatchObject({ ok: true });
    expect((overlapping as { warnings: string[] }).warnings.some((w) => w.includes('N-E1'))).toBe(true);
  });

  it('swaps width and depth for a 90 degree rotation when checking the room', () => {
    const rotated = validateLocation(draft({ pos_x: 4.7, pos_y: 2, width: 2, depth: 0.4, rotation_deg: 90 }), { all });
    expect((rotated as { warnings: string[] }).warnings).not.toContain(LOCATION_ERRORS.WARN_OUTSIDE_ROOM);
  });
});

describe('buildLocationTree', () => {
  it('nests children under their parents and sorts siblings by code', () => {
    const level2 = loc({ id: 'level-0', code: 'N-E1-N0', kind: 'level', parent_id: 'shelf-1', level_index: 0 });
    const tree = buildLocationTree([level, rug, shelf, level2]);
    expect(tree.map((node) => node.code)).toEqual(['C-ALF', 'N-E1']);
    expect(tree[1]?.children.map((node) => node.code)).toEqual(['N-E1-N0', 'N-E1-N1']);
    expect(tree[0]?.children).toEqual([]);
  });

  it('promotes an orphan (parent filtered out) to the root instead of dropping it', () => {
    const tree = buildLocationTree([level]);
    expect(tree.map((node) => node.id)).toEqual(['level-1']);
  });
});
