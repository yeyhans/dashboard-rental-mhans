import { InventoryError, isValidRowVersion } from '../lib/inventoryUnits';
import {
  LOCATION_ERRORS,
  buildLocationTree,
  parseLocationDraft,
  validateLocation,
  type LocationDraft,
  type LocationTreeNode,
} from '../lib/warehouseLocations';
import { supabaseAdmin } from '../lib/supabase';
import type { WarehouseLocation } from '../types/inventory';

/** Postgres unique-violation error code. */
const UNIQUE_VIOLATION = '23505';

const LOCATION_COLUMNS =
  'id, code, name, kind, parent_id, wall, pos_x, pos_y, width, depth, height, level_index, rotation_deg, ' +
  'is_active, row_version, created_at, updated_at, updated_by';

export interface LocationWriteResult {
  location: WarehouseLocation;
  /** Soft-check results (footprint outside the room, overlaps). Never block the write. */
  warnings: string[];
}

/**
 * Warehouse locations (migration 0021): the 5 x 5 m room's shelves, levels, boxes, floor areas and
 * the central rug. Admins manage them from the dashboard; the ops app reads the same table.
 *
 * The table is small (tens of rows), so every write reads the whole set once and validates the
 * draft in memory with `lib/warehouseLocations.ts`. The database repeats the hard rules (CHECKs,
 * the validate_parent trigger, the unique code), which close the race between that read and the
 * write. Updates use optimistic concurrency on `row_version`.
 *
 * Written against the 0021 contract; the migration is not applied to any database yet.
 */
export class WarehouseLocationService {
  /** `as any`: `warehouse_locations` is not in the generated `Database` type yet (0021). */
  private static client(): any {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available');
    }
    return supabaseAdmin as any;
  }

  static async list(options: { includeInactive?: boolean } = {}): Promise<WarehouseLocation[]> {
    let query = this.client().from('warehouse_locations').select(LOCATION_COLUMNS);
    if (!options.includeInactive) query = query.eq('is_active', true);
    const { data, error } = await query.order('code', { ascending: true });

    if (error) {
      console.error('[WarehouseLocationService] Error al listar las ubicaciones:', { error });
      throw error;
    }
    return (data as WarehouseLocation[]) || [];
  }

  /** Active locations nested by parent, siblings by code. */
  static async tree(): Promise<LocationTreeNode[]> {
    return buildLocationTree(await this.list());
  }

  static async create(raw: unknown, actorUserId: string | null): Promise<LocationWriteResult> {
    const all = await this.list({ includeInactive: true });
    const draft = parseLocationDraft(raw);
    const warnings = this.assertValid(draft, all, null);

    const { data, error } = await this.client()
      .from('warehouse_locations')
      .insert({ ...draft, updated_by: actorUserId })
      .select(LOCATION_COLUMNS)
      .single();

    if (error) this.throwWriteError(error, { code: draft.code });

    console.log('[WarehouseLocationService] Ubicación creada:', { id: (data as WarehouseLocation).id, code: draft.code });
    return { location: data as WarehouseLocation, warnings };
  }

  /** Partial update: absent fields keep their stored value. */
  static async update(id: string, raw: unknown, expectedRowVersion: number, actorUserId: string | null): Promise<LocationWriteResult> {
    if (!isValidRowVersion(expectedRowVersion)) throw new InventoryError(LOCATION_ERRORS.ROW_VERSION_REQUIRED, 400);

    const all = await this.list({ includeInactive: true });
    const current = all.find((location) => location.id === id);
    if (!current) throw new InventoryError(LOCATION_ERRORS.NOT_FOUND, 404);

    const draft = parseLocationDraft(raw, current);
    const warnings = this.assertValid(draft, all, id);

    const { data, error } = await this.client()
      .from('warehouse_locations')
      .update({ ...draft, updated_by: actorUserId })
      .eq('id', id)
      .eq('row_version', expectedRowVersion)
      .select(LOCATION_COLUMNS)
      .maybeSingle();

    if (error) this.throwWriteError(error, { id, code: draft.code });
    if (!data) throw new InventoryError(LOCATION_ERRORS.CONFLICT, 409);

    console.log('[WarehouseLocationService] Ubicación actualizada:', { id, code: draft.code });
    return { location: data as WarehouseLocation, warnings };
  }

  /**
   * Soft delete (`is_active = false`). Rows are never deleted: relocations reference them
   * (ON DELETE RESTRICT). Refused while active children hang from the location or non-archived
   * units are stored there, so nothing is left pointing at a closed place.
   */
  static async deactivate(id: string, expectedRowVersion: number, actorUserId: string | null): Promise<WarehouseLocation> {
    if (!isValidRowVersion(expectedRowVersion)) throw new InventoryError(LOCATION_ERRORS.ROW_VERSION_REQUIRED, 400);

    const all = await this.list({ includeInactive: true });
    const current = all.find((location) => location.id === id);
    if (!current) throw new InventoryError(LOCATION_ERRORS.NOT_FOUND, 404);
    if (all.some((location) => location.parent_id === id && location.is_active)) {
      throw new InventoryError(LOCATION_ERRORS.HAS_CHILDREN, 409);
    }

    const client = this.client();
    const { count, error: countError } = await client
      .from('serialised_assets')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', id)
      .neq('condition', 'retired');
    if (countError) {
      console.error('[WarehouseLocationService] Error al contar unidades en la ubicación:', { id, error: countError });
      throw countError;
    }
    if ((count ?? 0) > 0) throw new InventoryError(`${LOCATION_ERRORS.HAS_UNITS} (${count})`, 409);

    const { data, error } = await client
      .from('warehouse_locations')
      .update({ is_active: false, updated_by: actorUserId })
      .eq('id', id)
      .eq('row_version', expectedRowVersion)
      .select(LOCATION_COLUMNS)
      .maybeSingle();

    if (error) {
      console.error('[WarehouseLocationService] Error al desactivar la ubicación:', { id, error });
      throw error;
    }
    if (!data) throw new InventoryError(LOCATION_ERRORS.CONFLICT, 409);

    console.log('[WarehouseLocationService] Ubicación desactivada:', { id, code: current.code });
    return data as WarehouseLocation;
  }

  private static assertValid(draft: LocationDraft, all: WarehouseLocation[], selfId: string | null): string[] {
    const result = validateLocation(draft, { all, selfId });
    if (!result.ok) throw new InventoryError(result.error, result.status);
    return result.warnings;
  }

  private static throwWriteError(error: unknown, context: Record<string, unknown>): never {
    const { code } = error as { code?: string };
    if (code === UNIQUE_VIOLATION) throw new InventoryError(LOCATION_ERRORS.CODE_TAKEN, 409);
    console.error('[WarehouseLocationService] Error al guardar la ubicación:', { ...context, error });
    throw error;
  }
}

export default WarehouseLocationService;
