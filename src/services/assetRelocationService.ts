import { InventoryError, UNIT_ERRORS, isValidRowVersion } from '../lib/inventoryUnits';
import { LOCATION_ERRORS } from '../lib/warehouseLocations';
import { supabaseAdmin } from '../lib/supabase';
import {
  RELOCATION_CONFLICT_SQLSTATE,
  RELOCATION_SOURCES,
  type AssetRelocation,
  type InventoryUnit,
  type RelocationSource,
} from '../types/inventory';

const RELOCATION_COLUMNS = 'id, asset_id, from_location_id, to_location_id, moved_by_admin_id, moved_at, source, notes';

const UNIT_COLUMNS =
  'id, product_id, asset_tag, serial_number, condition, wear, location, location_id, kit_code, notes, row_version, created_at, updated_at';

export interface RelocateAssetInput {
  assetId: number;
  toLocationId: string;
  /** `admin_users.user_id` (auth uuid) of the person moving the unit; resolved from the session. */
  movedByUserId: string | null;
  source: RelocationSource;
  /** The unit's `row_version` as the operator saw it. */
  expectedRowVersion: number;
  notes?: string | null;
}

export interface RelocateAssetResult {
  relocation: AssetRelocation;
  unit: InventoryUnit;
}

/**
 * Moving a unit between warehouse locations (migration 0021).
 *
 * WHY NO SECOND WRITE. Inserting into `asset_relocations` IS the move: its AFTER INSERT trigger
 * (`asset_relocations_apply`) sets `serialised_assets.location_id` (and, through the sync trigger,
 * the derived `location` text) in the same statement, but only while the unit is still at
 * `from_location_id`. If another move landed first the trigger raises SQLSTATE PT409, the INSERT
 * rolls back, and nothing is half-written. So the service writes exactly one row and never
 * updates `location_id` itself — the move and its audit row are atomic by construction.
 *
 * The `row_version` comparison before the insert is an application-level guard (a TOCTOU window
 * remains between the read and the insert); the trigger's `from_location_id` check is the real
 * guard for the location itself. Both conflicts answer the same 409.
 *
 * Written against the 0021 contract; the migration is not applied to any database yet.
 */
export class AssetRelocationService {
  /** `as any`: the 0021 tables/columns are not in the generated `Database` type yet. */
  private static client(): any {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available');
    }
    return supabaseAdmin as any;
  }

  static async relocateAsset(input: RelocateAssetInput): Promise<RelocateAssetResult> {
    if (!Number.isInteger(input.assetId) || input.assetId <= 0) throw new InventoryError(UNIT_ERRORS.INVALID_ID, 400);
    const toLocationId = typeof input.toLocationId === 'string' ? input.toLocationId.trim() : '';
    if (!toLocationId) throw new InventoryError(LOCATION_ERRORS.TARGET_REQUIRED, 400);
    if (!isValidRowVersion(input.expectedRowVersion)) throw new InventoryError(UNIT_ERRORS.ROW_VERSION_REQUIRED, 400);
    if (!(RELOCATION_SOURCES as readonly string[]).includes(input.source)) {
      throw new InventoryError(LOCATION_ERRORS.SOURCE_INVALID, 400);
    }
    const notes = typeof input.notes === 'string' && input.notes.trim() ? input.notes.trim() : null;

    const client = this.client();

    const { data: unit, error: unitError } = await client
      .from('serialised_assets')
      .select('id, location_id, row_version, condition')
      .eq('id', input.assetId)
      .maybeSingle();
    if (unitError) {
      console.error('[AssetRelocationService] Error al leer la unidad:', { assetId: input.assetId, error: unitError });
      throw unitError;
    }
    if (!unit) throw new InventoryError(UNIT_ERRORS.NOT_FOUND, 404);
    if (unit.condition === 'retired') throw new InventoryError(UNIT_ERRORS.ARCHIVED, 409);
    if (unit.row_version !== input.expectedRowVersion) throw new InventoryError(UNIT_ERRORS.CONFLICT, 409);
    if (unit.location_id === toLocationId) throw new InventoryError(LOCATION_ERRORS.SAME_LOCATION, 400);

    const { data: target, error: targetError } = await client
      .from('warehouse_locations')
      .select('id, code, name, is_active')
      .eq('id', toLocationId)
      .maybeSingle();
    if (targetError) {
      console.error('[AssetRelocationService] Error al leer la ubicación de destino:', { toLocationId, error: targetError });
      throw targetError;
    }
    if (!target) throw new InventoryError(LOCATION_ERRORS.NOT_FOUND, 404);
    if (!target.is_active) throw new InventoryError(LOCATION_ERRORS.INACTIVE, 400);

    const { data: relocation, error } = await client
      .from('asset_relocations')
      .insert({
        asset_id: input.assetId,
        from_location_id: unit.location_id ?? null,
        to_location_id: toLocationId,
        moved_by_admin_id: input.movedByUserId,
        source: input.source,
        notes,
      })
      .select(RELOCATION_COLUMNS)
      .single();

    if (error) {
      if ((error as { code?: string }).code === RELOCATION_CONFLICT_SQLSTATE) {
        throw new InventoryError(UNIT_ERRORS.CONFLICT, 409);
      }
      console.error('[AssetRelocationService] Error al registrar la reubicación:', {
        assetId: input.assetId,
        toLocationId,
        error,
      });
      throw error;
    }

    const { data: moved, error: movedError } = await client
      .from('serialised_assets')
      .select(UNIT_COLUMNS)
      .eq('id', input.assetId)
      .maybeSingle();
    if (movedError) {
      console.error('[AssetRelocationService] Error al releer la unidad movida:', { assetId: input.assetId, error: movedError });
      throw movedError;
    }

    console.log('[AssetRelocationService] Unidad reubicada:', {
      assetId: input.assetId,
      from: unit.location_id ?? null,
      to: toLocationId,
      source: input.source,
    });
    return { relocation: relocation as AssetRelocation, unit: moved as InventoryUnit };
  }

  /** A unit's moves, newest first. */
  static async listForAsset(assetId: number): Promise<AssetRelocation[]> {
    if (!Number.isInteger(assetId) || assetId <= 0) throw new InventoryError(UNIT_ERRORS.INVALID_ID, 400);
    const { data, error } = await this.client()
      .from('asset_relocations')
      .select(RELOCATION_COLUMNS)
      .eq('asset_id', assetId)
      .order('moved_at', { ascending: false });

    if (error) {
      console.error('[AssetRelocationService] Error al listar reubicaciones:', { assetId, error });
      throw error;
    }
    return (data as AssetRelocation[]) || [];
  }
}

export default AssetRelocationService;
