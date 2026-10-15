import { describe, expect, it } from 'vitest';

import {
  BULK_MAX_UNITS,
  InventoryError,
  UNIT_ERRORS,
  deriveUnitStatus,
  isValidRowVersion,
  planBulkUnits,
  sanitizeUnitPatch,
} from '../inventoryUnits';

/**
 * Pure rules behind unit editing and bulk intake (migration 0021). The service applies them; the
 * UI can run the same functions before a round trip.
 */
describe('deriveUnitStatus', () => {
  it('reports in_rental for a non-retired unit with an open checkout, whatever its condition', () => {
    expect(deriveUnitStatus('operational', true)).toBe('in_rental');
    expect(deriveUnitStatus('damaged', true)).toBe('in_rental');
    expect(deriveUnitStatus('blocked', true)).toBe('in_rental');
  });

  it('reports the stored condition when the unit is in the warehouse', () => {
    expect(deriveUnitStatus('operational', false)).toBe('operational');
    expect(deriveUnitStatus('maintenance', false)).toBe('maintenance');
    expect(deriveUnitStatus('blocked', false)).toBe('blocked');
  });

  it('keeps retired units retired (same rule as the product_unit_counts view)', () => {
    expect(deriveUnitStatus('retired', true)).toBe('retired');
    expect(deriveUnitStatus('retired', false)).toBe('retired');
  });
});

describe('isValidRowVersion', () => {
  it('accepts positive integers only', () => {
    expect(isValidRowVersion(1)).toBe(true);
    expect(isValidRowVersion(42)).toBe(true);
    expect(isValidRowVersion(0)).toBe(false);
    expect(isValidRowVersion(-1)).toBe(false);
    expect(isValidRowVersion(1.5)).toBe(false);
    expect(isValidRowVersion('1')).toBe(false);
    expect(isValidRowVersion(undefined)).toBe(false);
  });
});

describe('sanitizeUnitPatch', () => {
  it('keeps only editable fields and trims text', () => {
    const patch = sanitizeUnitPatch({
      serial_number: '  SN-1 ',
      condition: 'maintenance',
      wear: 'new',
      kit_code: ' KIT-1 ',
      notes: ' revisar sensor ',
      asset_tag: 'MH-99999',
      product_id: 9,
      row_version: 3,
      location_id: 'x',
    });
    expect(patch).toEqual({
      serial_number: 'SN-1',
      condition: 'maintenance',
      wear: 'new',
      kit_code: 'KIT-1',
      notes: 'revisar sensor',
    });
  });

  it('turns blank optional text into null', () => {
    expect(sanitizeUnitPatch({ kit_code: '  ', notes: '' })).toEqual({ kit_code: null, notes: null });
  });

  it('accepts blocked (0021) as a condition', () => {
    expect(sanitizeUnitPatch({ condition: 'blocked' })).toEqual({ condition: 'blocked' });
  });

  it('refuses retired: archiving has its own action', () => {
    expect(() => sanitizeUnitPatch({ condition: 'retired' })).toThrow(UNIT_ERRORS.USE_ARCHIVE);
  });

  it('refuses an unknown condition or wear with a 400 InventoryError', () => {
    try {
      sanitizeUnitPatch({ condition: 'lost' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InventoryError);
      expect((error as InventoryError).status).toBe(400);
    }
    expect(() => sanitizeUnitPatch({ wear: 'mint' })).toThrow(UNIT_ERRORS.INVALID_WEAR);
  });

  it('refuses a blank serial number', () => {
    expect(() => sanitizeUnitPatch({ serial_number: '   ' })).toThrow(UNIT_ERRORS.SERIAL_REQUIRED);
  });

  it('refuses a patch with nothing editable in it', () => {
    expect(() => sanitizeUnitPatch({ asset_tag: 'MH-00001' })).toThrow(UNIT_ERRORS.EMPTY_PATCH);
    expect(() => sanitizeUnitPatch(null)).toThrow(UNIT_ERRORS.EMPTY_PATCH);
  });
});

describe('planBulkUnits', () => {
  it('allocates consecutive tags after the highest one assigned', () => {
    const plan = planBulkUnits({ highestTag: 'MH-00041', count: 3 });
    expect(plan.map((unit) => unit.asset_tag)).toEqual(['MH-00042', 'MH-00043', 'MH-00044']);
  });

  it('starts at MH-00001 before the count has begun', () => {
    expect(planBulkUnits({ highestTag: null, count: 1 })[0]?.asset_tag).toBe('MH-00001');
  });

  it('uses the asset tag as placeholder serial when no prefix is given (serial is NOT NULL and unique)', () => {
    const plan = planBulkUnits({ highestTag: 'MH-00009', count: 2 });
    expect(plan.map((unit) => unit.serial_number)).toEqual(['MH-00010', 'MH-00011']);
  });

  it('derives serials from the prefix and the tag sequence so two batches never collide', () => {
    const plan = planBulkUnits({ highestTag: 'MH-00009', count: 2, serialPrefix: ' b10 ' });
    expect(plan.map((unit) => unit.serial_number)).toEqual(['B10-00010', 'B10-00011']);
  });

  it('refuses counts outside 1..BULK_MAX_UNITS', () => {
    expect(() => planBulkUnits({ highestTag: null, count: 0 })).toThrow(UNIT_ERRORS.BULK_COUNT);
    expect(() => planBulkUnits({ highestTag: null, count: BULK_MAX_UNITS + 1 })).toThrow(UNIT_ERRORS.BULK_COUNT);
    expect(() => planBulkUnits({ highestTag: null, count: 2.5 })).toThrow(UNIT_ERRORS.BULK_COUNT);
  });

  it('refuses a malformed serial prefix', () => {
    expect(() => planBulkUnits({ highestTag: null, count: 1, serialPrefix: 'a b' })).toThrow(UNIT_ERRORS.SERIAL_PREFIX);
  });

  it('refuses a batch that would run past MH-99999', () => {
    expect(() => planBulkUnits({ highestTag: 'MH-99998', count: 2 })).toThrow(UNIT_ERRORS.TAGS_EXHAUSTED);
  });
});
