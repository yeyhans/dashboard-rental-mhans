import { describe, expect, it } from 'vitest';
import {
  availabilityFromMovements,
  hasOpenCheckout,
  validateMovementTransition,
} from '../assetMovements';
import type { AssetMovementLike } from '../../types/assetMovements';

function movement(assetId: number, direction: 'checkout' | 'checkin', checkedAt: string): AssetMovementLike {
  return { asset_id: assetId, direction, checked_at: checkedAt };
}

describe('hasOpenCheckout', () => {
  it('is false when the asset has no movement history', () => {
    expect(hasOpenCheckout([])).toBe(false);
  });

  it('is true when the latest movement for the asset is a checkout', () => {
    const history = [
      movement(1, 'checkin', '2026-08-01T10:00:00Z'),
      movement(1, 'checkout', '2026-08-10T10:00:00Z'),
    ];
    expect(hasOpenCheckout(history)).toBe(true);
  });

  it('is false when the latest movement for the asset is a checkin', () => {
    const history = [
      movement(1, 'checkout', '2026-08-01T10:00:00Z'),
      movement(1, 'checkin', '2026-08-05T10:00:00Z'),
    ];
    expect(hasOpenCheckout(history)).toBe(false);
  });
});

describe('validateMovementTransition', () => {
  it('rejects a checkout when the asset already has an open checkout', () => {
    const history = [movement(1, 'checkout', '2026-08-01T10:00:00Z')];
    const result = validateMovementTransition('checkout', history);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('El equipo ya tiene un checkout abierto, debe hacer check-in primero');
  });

  it('accepts a checkout when the asset has no open checkout', () => {
    const result = validateMovementTransition('checkout', []);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects a checkin when the asset has no open checkout', () => {
    const history = [movement(1, 'checkin', '2026-08-01T10:00:00Z')];
    const result = validateMovementTransition('checkin', history);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('El equipo no tiene un checkout abierto para hacer check-in');
  });

  it('accepts a checkin when the asset has an open checkout', () => {
    const history = [movement(1, 'checkout', '2026-08-01T10:00:00Z')];
    const result = validateMovementTransition('checkin', history);
    expect(result.valid).toBe(true);
  });
});

describe('availabilityFromMovements', () => {
  it('reports every asset as available when there are no movements', () => {
    const result = availabilityFromMovements([1, 2, 3], []);
    expect(result).toEqual({
      totalUnits: 3,
      outstandingUnits: 0,
      availableUnits: 3,
      outstandingAssetIds: [],
    });
  });

  it('counts an asset as outstanding when its latest movement is an open checkout', () => {
    const movements = [
      movement(1, 'checkout', '2026-08-10T10:00:00Z'),
      movement(2, 'checkout', '2026-08-01T10:00:00Z'),
      movement(2, 'checkin', '2026-08-05T10:00:00Z'),
    ];
    const result = availabilityFromMovements([1, 2, 3], movements);
    expect(result).toEqual({
      totalUnits: 3,
      outstandingUnits: 1,
      availableUnits: 2,
      outstandingAssetIds: [1],
    });
  });

  it('ignores movements for asset ids outside the denominator', () => {
    const movements = [movement(99, 'checkout', '2026-08-10T10:00:00Z')];
    const result = availabilityFromMovements([1, 2], movements);
    expect(result.outstandingUnits).toBe(0);
    expect(result.availableUnits).toBe(2);
  });
});
