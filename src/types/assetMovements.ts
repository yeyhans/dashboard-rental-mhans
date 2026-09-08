/**
 * Asset movements (T-026 gap 1/4, Check-In audit trail).
 *
 * Types live here rather than in `src/types/database.ts` because that file is generated from the
 * live schema and `0006_t026_schema_gaps.sql` has NOT been applied to any database yet (pending
 * staging rehearsal — see `openspec/changes/consolidado-web-2027/apply-progress.md`, "T-026
 * resuelto"). Replace this file's interfaces with the regenerated `Database['public']['Tables']`
 * types once the migration lands and `npx supabase gen types typescript` is re-run.
 */

/** The `asset_movements.direction` CHECK constraint values. */
export const MOVEMENT_DIRECTIONS = ['checkout', 'checkin'] as const;

export type MovementDirection = (typeof MOVEMENT_DIRECTIONS)[number];

export function isMovementDirection(value: unknown): value is MovementDirection {
  return typeof value === 'string' && (MOVEMENT_DIRECTIONS as readonly string[]).includes(value);
}

export interface AssetMovement {
  id: number;
  asset_id: number;
  order_id: number;
  direction: MovementDirection;
  condition_notes: string | null;
  checked_by_admin_id: number | null;
  checked_at: string;
}

export interface AssetMovementInput {
  asset_id: number;
  order_id: number;
  direction: MovementDirection;
  condition_notes?: string | null;
  checked_by_admin_id?: number | null;
}

/** The minimal shape the pure `lib/assetMovements.ts` derivations need. */
export interface AssetMovementLike {
  readonly asset_id: number;
  readonly direction: MovementDirection;
  readonly checked_at: string;
}
