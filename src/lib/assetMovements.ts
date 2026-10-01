/**
 * Asset movements — the pure derivations (T-026 gap 1/4, Check-In numerator + availability
 * numerator).
 *
 * `asset_movements` is the audit trail of checkout/checkin events against `serialised_assets`
 * (0004). This module never touches Supabase: it takes movement rows already fetched by
 * `assetMovementService.ts` and derives (a) whether a requested transition is legal, and (b) which
 * assets are currently out, given a `serialised_assets` id list as the denominator.
 *
 * "Open checkout" = an asset's most recent movement (by `checked_at`) is a `checkout` with no
 * later `checkin`. This mirrors the migration header's stated query shape for gap 4.
 */

import type { AssetMovementLike, MovementDirection } from '../types/assetMovements';

/**
 * Single source of truth for the transition-rejection messages (R3-103, review R3 on
 * `4de3c5c`). `validateMovementTransition` returns these; `assetMovementService.ts` re-throws
 * them (including on the DB-level unique-violation path, R3-102b) and
 * `api/inventory/movements.ts`'s `CLIENT_ERRORS` matcher imports the same constants — no
 * duplicated literal strings, so the three cannot drift out of sync with each other.
 */
export const MOVEMENT_TRANSITION_ERRORS = {
  OPEN_CHECKOUT_EXISTS: 'El equipo ya tiene un checkout abierto, debe hacer check-in primero',
  NO_OPEN_CHECKOUT: 'El equipo no tiene un checkout abierto para hacer check-in',
} as const;

/**
 * True when the asset's most recent movement in `history` is an unmatched `checkout`.
 * `history` MUST already be filtered to a single asset — this function does not group by
 * `asset_id` (see `availabilityFromMovements` for the multi-asset case).
 */
export function hasOpenCheckout(history: readonly AssetMovementLike[]): boolean {
  if (history.length === 0) return false;

  const [latest] = [...history].sort(
    (a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime()
  );

  return latest?.direction === 'checkout';
}

export interface MovementTransitionResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a requested checkout/checkin against one asset's movement history. `history` must
 * already be scoped to the single asset being checked in/out.
 */
export function validateMovementTransition(
  direction: MovementDirection,
  history: readonly AssetMovementLike[]
): MovementTransitionResult {
  const open = hasOpenCheckout(history);

  if (direction === 'checkout' && open) {
    return { valid: false, error: MOVEMENT_TRANSITION_ERRORS.OPEN_CHECKOUT_EXISTS };
  }

  if (direction === 'checkin' && !open) {
    return { valid: false, error: MOVEMENT_TRANSITION_ERRORS.NO_OPEN_CHECKOUT };
  }

  return { valid: true };
}

export interface AvailabilityResult {
  /** Denominator: total physical units considered (from `serialised_assets`). */
  totalUnits: number;
  /** Numerator: units whose latest movement is an open checkout. */
  outstandingUnits: number;
  availableUnits: number;
  outstandingAssetIds: number[];
}

/**
 * Availability across a set of assets (gap 4). `assetIds` is the denominator — normally every
 * `serialised_assets.id` for a product, or a whole location. `movements` may include rows for
 * assets outside `assetIds`; those are ignored rather than padding the outstanding count.
 */
export function availabilityFromMovements(
  assetIds: readonly number[],
  movements: readonly AssetMovementLike[]
): AvailabilityResult {
  const denominator = new Set(assetIds);

  const byAsset = new Map<number, AssetMovementLike[]>();
  for (const movement of movements) {
    if (!denominator.has(movement.asset_id)) continue;
    const list = byAsset.get(movement.asset_id) ?? [];
    list.push(movement);
    byAsset.set(movement.asset_id, list);
  }

  const outstandingAssetIds: number[] = [];
  for (const [assetId, history] of byAsset) {
    if (hasOpenCheckout(history)) outstandingAssetIds.push(assetId);
  }
  outstandingAssetIds.sort((a, b) => a - b);

  const totalUnits = assetIds.length;
  const outstandingUnits = outstandingAssetIds.length;

  return {
    totalUnits,
    outstandingUnits,
    availableUnits: totalUnits - outstandingUnits,
    outstandingAssetIds,
  };
}
