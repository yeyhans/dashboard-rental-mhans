import { hasOpenCheckout } from '../lib/assetMovements';
import { supabaseAdmin } from '../lib/supabase';
import { isMovementDirection, type AssetMovement, type AssetMovementInput } from '../types/assetMovements';

/**
 * Asset movements — checkout/checkin audit trail against `serialised_assets` (T-026 gap 1/4).
 *
 * NOTE: `asset_movements` (`0006_t026_schema_gaps.sql`) has not been applied to any database yet
 * (pending staging rehearsal, see `apply-progress.md` "T-026 resuelto"). This service is written
 * and tested against the migration's contract ahead of that rehearsal — same "schema-first" shape
 * `serialisedAssetService.ts` used for `serialised_assets` in 0004.
 *
 * The transition rule (no double checkout, no checkin without an open checkout) lives in the pure
 * `lib/assetMovements.ts` — this class only fetches the asset's history and applies it.
 */
export class AssetMovementService {
  /**
   * `as any`: `asset_movements` is not yet in the generated `Database` type (the migration has
   * not been applied to any database — see the module note above), so the typed client rejects
   * `.from('asset_movements')`. Replace with the typed client once
   * `npx supabase gen types typescript` is re-run after the migration lands, same as
   * `serialisedAssetService.ts` did after 0004.
   */
  private static ensureSupabaseAdmin() {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available');
    }
    return supabaseAdmin as any;
  }

  /**
   * Full movement history for one asset, newest first. Used both to validate the next transition
   * and to render a Check-In screen's per-unit timeline.
   */
  static async getHistoryForAsset(assetId: number): Promise<AssetMovement[]> {
    const client = this.ensureSupabaseAdmin();
    const { data, error } = await client
      .from('asset_movements')
      .select('*')
      .eq('asset_id', assetId)
      .order('checked_at', { ascending: false });

    if (error) {
      console.error('[AssetMovementService] Error al obtener el historial del equipo:', {
        assetId,
        error,
      });
      throw error;
    }

    return (data as AssetMovement[]) || [];
  }

  /**
   * Records a checkout or checkin against an asset, after validating the transition against that
   * asset's own history. Rejects before hitting the database if `direction` is not one of the
   * CHECK constraint's values.
   */
  static async recordMovement(input: AssetMovementInput): Promise<AssetMovement> {
    if (!isMovementDirection(input.direction)) {
      throw new Error('Dirección inválida. Debe ser "checkout" o "checkin"');
    }
    if (!Number.isInteger(input.asset_id) || input.asset_id <= 0) {
      throw new Error('Debes indicar un equipo válido');
    }
    if (!Number.isInteger(input.order_id) || input.order_id <= 0) {
      throw new Error('Debes indicar una orden válida');
    }

    const history = await this.getHistoryForAsset(input.asset_id);
    const open = hasOpenCheckout(history);

    if (input.direction === 'checkout' && open) {
      throw new Error('El equipo ya tiene un checkout abierto, debe hacer check-in primero');
    }
    if (input.direction === 'checkin' && !open) {
      throw new Error('El equipo no tiene un checkout abierto para hacer check-in');
    }

    const client = this.ensureSupabaseAdmin();
    const { data, error } = await client
      .from('asset_movements')
      .insert({
        asset_id: input.asset_id,
        order_id: input.order_id,
        direction: input.direction,
        condition_notes: input.condition_notes ?? null,
        checked_by_admin_id: input.checked_by_admin_id ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('[AssetMovementService] Error al registrar el movimiento:', {
        assetId: input.asset_id,
        orderId: input.order_id,
        direction: input.direction,
        error,
      });
      throw error;
    }

    console.log('[AssetMovementService] Movimiento registrado:', {
      movementId: (data as AssetMovement).id,
      assetId: input.asset_id,
      direction: input.direction,
    });

    return data as AssetMovement;
  }

  /** Lists movements for one order — the Check-In screen's per-order view. */
  static async listByOrder(orderId: number): Promise<AssetMovement[]> {
    const client = this.ensureSupabaseAdmin();
    const { data, error } = await client
      .from('asset_movements')
      .select('*')
      .eq('order_id', orderId)
      .order('checked_at', { ascending: false });

    if (error) {
      console.error('[AssetMovementService] Error al listar movimientos de la orden:', {
        orderId,
        error,
      });
      throw error;
    }

    return (data as AssetMovement[]) || [];
  }
}

export default AssetMovementService;
