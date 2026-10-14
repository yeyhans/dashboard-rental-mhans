import {
  ASSET_TAG_FORMAT_ERROR,
  ASSET_TAG_TAKEN_ERROR,
  isValidAssetTag,
  normalizeAssetTag,
} from '../lib/assetTag';
import { findMissingFields } from '../lib/inventory/dataQuality';
import {
  InventoryError,
  UNIT_ERRORS,
  assertEditableCondition,
  deriveUnitStatus,
  isUnitWear,
  isValidRowVersion,
  normalizeSerialPrefix,
  planBulkUnits,
  sanitizeUnitPatch,
  serialKey,
} from '../lib/inventoryUnits';
import { LOCATION_ERRORS, describeLocation } from '../lib/warehouseLocations';
import { quantityDiscrepancy, totalValueClp } from '../lib/productValuation';
import { supabaseAdmin } from '../lib/supabase';
import {
  ASSET_CONDITIONS,
  type DataQualityReport,
  type IncompleteProduct,
  type IntakeProgress,
  type SerialisedAsset,
  type SerialisedAssetInput,
  type InventoryUnit,
  type LocationKind,
  type UnitCondition,
  type UnitDisplayStatus,
  type UnitWear,
} from '../types/inventory';

/**
 * Serialised inventory intake (M6, T-034/T-035/T-036).
 *
 * Backs the admin intake UI that unblocks the client's physical count (ADR-003, O-5). The one
 * rule that shapes this whole service: a product's data quality NEVER blocks an entry. The
 * catalogue has rows with no `sku`, no `brands` and no `stock_status`, and the count cannot wait
 * for them to be fixed — see `serialised-inventory-operations/spec.md`, "Intake data quality does
 * not block entry, but is flagged". Incompleteness is reported by `getDataQualityReport`, never
 * enforced by `createAsset`.
 */

/** `products.status` value that marks a catalogue row as live (WooCommerce-derived vocabulary). */
const PUBLISHED_STATUS = 'publish';

/**
 * Columns the tag lookup returns. Explicit rather than `*` so a future column (a photo URL, a
 * purchase price) does not silently ride along into a response that reaches the browser.
 */
const ASSET_COLUMNS =
  'id, product_id, asset_tag, serial_number, condition, location, kit_code, notes, created_at, updated_at';

/** Every `serialised_assets` column the 0021 unit screens read (InventoryUnit). */
const UNIT_COLUMNS =
  'id, product_id, asset_tag, serial_number, condition, wear, location, location_id, kit_code, notes, row_version, created_at, updated_at';

/** Postgres unique-violation error code. */
const UNIQUE_VIOLATION = '23505';

/** One unit as the product's "Inventario" tab shows it. */
export interface InventoryUnitView extends InventoryUnit {
  /** "En arriendo" derived from `asset_current_state`; otherwise the stored condition. */
  status: UnitDisplayStatus;
  /** The order the unit is out on, when `status` is `in_rental`. */
  open_order_id: number | null;
  location_detail: { id: string; code: string; name: string; kind: LocationKind } | null;
}

/** Defaults applied to every unit of a bulk intake. */
export interface BulkUnitDefaults {
  wear?: UnitWear;
  condition?: UnitCondition;
  /** A `warehouse_locations` id; wins over `location`. */
  location_id?: string | null;
  /** Free-text location, for units not yet placed in the structured plan. */
  location?: string | null;
  serial_prefix?: string | null;
  kit_code?: string | null;
  notes?: string | null;
}

/** Name of the UNIQUE index on `asset_tag` (0009). Postgres quotes it inside the 23505 message. */
const ASSET_TAG_UNIQUE_INDEX = 'serialised_assets_asset_tag_key';

/** Name of the case-insensitive UNIQUE index on `serial_number` (0004). */
const SERIAL_UNIQUE_INDEX = 'serialised_assets_serial_number_lower_key';

export class SerialisedAssetService {
  private static ensureSupabaseAdmin() {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available');
    }
    return supabaseAdmin;
  }

  /**
   * Records one physical unit against an existing product.
   *
   * Validates the asset's own fields and the product's existence — nothing else. In particular it
   * does not read `sku`, `brands`, `type` or `stock_status` before writing.
   */
  static async createAsset(input: SerialisedAssetInput): Promise<SerialisedAsset> {
    // The tag arrives as a scanner or a human produced it (lower case, trailing Enter). Normalise
    // first so the value validated is the value stored, and so the CHECK constraint never fires
    // on something the UI already accepted.
    const assetTag = normalizeAssetTag(input.asset_tag || '');
    const serialNumber = (input.serial_number || '').trim();
    const location = (input.location || '').trim();
    const kitCode = input.kit_code ? input.kit_code.trim() : '';
    const notes = input.notes ? input.notes.trim() : '';

    if (!Number.isInteger(input.product_id) || input.product_id <= 0) {
      throw new Error('Debes seleccionar un producto válido');
    }
    if (!isValidAssetTag(assetTag)) {
      throw new Error(ASSET_TAG_FORMAT_ERROR);
    }
    if (!serialNumber) {
      throw new Error('El número de serie es obligatorio');
    }
    if (!location) {
      throw new Error('La ubicación es obligatoria');
    }
    if (!ASSET_CONDITIONS.includes(input.condition)) {
      throw new Error(`Condición inválida. Debe ser una de: ${ASSET_CONDITIONS.join(', ')}`);
    }

    const client = this.ensureSupabaseAdmin();

    // Existence only. The FK would catch an orphan too, but as a 23503 the UI cannot phrase well.
    const { data: product, error: productError } = await client
      .from('products')
      .select('id')
      .eq('id', input.product_id)
      .single();

    if (productError && (productError as { code?: string }).code !== 'PGRST116') {
      console.error('[SerialisedAssetService] Error al verificar el producto:', {
        productId: input.product_id,
        error: productError,
      });
      throw productError;
    }
    if (!product) {
      throw new Error('El producto indicado no existe');
    }

    const { data, error } = await client
      .from('serialised_assets')
      .insert({
        product_id: input.product_id,
        asset_tag: assetTag,
        serial_number: serialNumber,
        condition: input.condition,
        location,
        kit_code: kitCode || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      const { code, message } = error as { code?: string; message?: string };
      if (code === '23505') {
        // Two UNIQUE indexes can raise this: the serial (0004) and the tag (0009). Postgres names
        // the violated index in the message, and the operator needs to know which sticker to
        // check — the one on the unit or the one on the roll.
        if ((message || '').includes(ASSET_TAG_UNIQUE_INDEX)) {
          throw new Error(ASSET_TAG_TAKEN_ERROR);
        }
        if ((message || '').includes(SERIAL_UNIQUE_INDEX)) {
          throw new Error('Ya existe un equipo registrado con ese número de serie');
        }
        // R4-003: a third UNIQUE constraint would otherwise be reported as a serial collision and
        // send the operator to check the wrong sticker. Name it in the log; stay generic to them.
        console.error('[SerialisedAssetService] Unique violation on unknown constraint', { message });
        throw new Error('Ya existe un equipo con esos datos');
      }
      console.error('[SerialisedAssetService] Error al registrar el equipo:', {
        productId: input.product_id,
        assetTag,
        serialNumber,
        error,
      });
      throw error;
    }

    console.log('[SerialisedAssetService] Equipo registrado:', {
      assetId: (data as SerialisedAsset).id,
      assetTag,
      productId: input.product_id,
    });

    return data as SerialisedAsset;
  }

  /**
   * Looks a unit up by its internal asset tag — the scan path. The stored value is canonical
   * (upper case, enforced by CHECK), so after normalisation an exact `eq` is correct and uses the
   * UNIQUE index. A malformed input cannot match any row and returns null without a round trip.
   */
  static async getByAssetTag(assetTag: string): Promise<SerialisedAsset | null> {
    const normalised = normalizeAssetTag(assetTag || '');
    if (!isValidAssetTag(normalised)) return null;

    const client = this.ensureSupabaseAdmin();
    const { data, error } = await client
      .from('serialised_assets')
      .select(ASSET_COLUMNS)
      .eq('asset_tag', normalised)
      .maybeSingle();

    if (error && (error as { code?: string }).code !== 'PGRST116') {
      console.error('[SerialisedAssetService] Error al buscar por asset tag:', {
        assetTag: normalised,
        error,
      });
      throw error;
    }

    return (data as SerialisedAsset | null) || null;
  }

  /**
   * The highest tag assigned so far, or null before the count has started. The label page uses it
   * to suggest where the next roll begins. Lexicographic order is numeric order here because the
   * format is fixed-width and zero-padded — that is one of the reasons the format is.
   */
  static async getHighestAssetTag(): Promise<string | null> {
    const client = this.ensureSupabaseAdmin();
    const { data, error } = await client
      .from('serialised_assets')
      .select('asset_tag')
      .order('asset_tag', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && (error as { code?: string }).code !== 'PGRST116') {
      console.error('[SerialisedAssetService] Error al obtener el asset tag más alto:', { error });
      throw error;
    }

    return (data as { asset_tag: string } | null)?.asset_tag ?? null;
  }

  /**
   * Looks a unit up by serial number, the spec's stated read path. Case- and whitespace-
   * insensitive to match the `lower(btrim(serial_number))` unique index: an admin reading a label
   * off a camera body should not have to reproduce its casing.
   */
  static async getAssetBySerial(serialNumber: string): Promise<SerialisedAsset | null> {
    const normalised = (serialNumber || '').trim();
    if (!normalised) return null;

    const client = this.ensureSupabaseAdmin();
    // `ilike` without wildcards is an exact match that ignores case, which is what the
    // `lower(btrim(serial_number))` unique index enforces on write. `eq` would miss a unit stored
    // as "PROFOTO-B10-0007" when the admin types the serial off the label in lower case.
    // Escape the LIKE metacharacters so a serial containing % or _ stays an exact lookup.
    const pattern = normalised.replace(/([\\%_])/g, '\\$1');
    const { data, error } = await client
      .from('serialised_assets')
      .select('*')
      .ilike('serial_number', pattern)
      .maybeSingle();

    if (error && (error as { code?: string }).code !== 'PGRST116') {
      console.error('[SerialisedAssetService] Error al buscar por número de serie:', {
        serialNumber: normalised,
        error,
      });
      throw error;
    }

    return (data as SerialisedAsset) || null;
  }

  static async listAssetsByProduct(productId: number): Promise<SerialisedAsset[]> {
    const client = this.ensureSupabaseAdmin();
    const { data, error } = await client
      .from('serialised_assets')
      .select(ASSET_COLUMNS)
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SerialisedAssetService] Error al listar equipos del producto:', {
        productId,
        error,
      });
      throw error;
    }

    // `asset_tag` is not in the hand-written `serialised_assets` block of `database.ts` yet, so
    // the typed client cannot name this row shape; the column list above is the contract.
    return (data as unknown as SerialisedAsset[]) || [];
  }

  /**
   * The reviewable list the spec requires: products whose audited fields are unusable for a count
   * sheet, plus — since the client's spreadsheet came in (0010) — products whose counted units
   * disagree with, or were never declared against, the quantity the client says they own. An
   * empty string counts as missing — the audit found both NULLs and blanks, and neither tells a
   * counter what they are holding.
   *
   * The counted quantity is `count(serialised_assets)` per product, computed here rather than
   * stored; the total value is derived per row and never stored either.
   */
  static async getDataQualityReport(): Promise<DataQualityReport> {
    const client = this.ensureSupabaseAdmin();
    const { data, error } = await client
      .from('products')
      .select(
        'id, name, slug, sku, brands, type, status, stock_status, declared_quantity, market_value_clp, used_value_clp'
      )
      .order('id', { ascending: true });

    if (error) {
      console.error('[SerialisedAssetService] Error al construir el reporte de calidad:', { error });
      throw error;
    }

    const { data: assets, error: assetsError } = await client
      .from('serialised_assets')
      .select('product_id');

    if (assetsError) {
      console.error('[SerialisedAssetService] Error al contar equipos para el reporte de calidad:', {
        error: assetsError,
      });
      throw assetsError;
    }

    const countedByProduct = new Map<number, number>();
    for (const row of (assets as { product_id: number }[]) || []) {
      countedByProduct.set(row.product_id, (countedByProduct.get(row.product_id) ?? 0) + 1);
    }

    const products = (data as Record<string, unknown>[]) || [];
    const incomplete: IncompleteProduct[] = [];

    for (const product of products) {
      const id = product.id as number;
      const missing = findMissingFields(product);
      const countedQuantity = countedByProduct.get(id) ?? 0;
      const declaredQuantity = (product.declared_quantity as number | null) ?? null;
      const usedValueClp = (product.used_value_clp as number | null) ?? null;
      const discrepancy = quantityDiscrepancy({ countedQuantity, declaredQuantity });

      if (missing.length === 0 && discrepancy === 'match') continue;

      incomplete.push({
        id,
        name: (product.name as string) ?? null,
        slug: (product.slug as string) ?? null,
        sku: (product.sku as string) ?? null,
        status: (product.status as string) ?? null,
        missing_fields: missing,
        declared_quantity: declaredQuantity,
        counted_quantity: countedQuantity,
        market_value_clp: (product.market_value_clp as number | null) ?? null,
        used_value_clp: usedValueClp,
        total_value_clp: totalValueClp({ countedQuantity, declaredQuantity, usedValueClp }),
        discrepancy,
      });
    }

    return { total: products.length, incomplete: incomplete.length, products: incomplete };
  }

  /**
   * Physical-count progress (ADR-003 / O-5). Counts distinct products covered, not asset rows:
   * entering ten bodies of one model is not ten models counted.
   */
  static async getIntakeProgress(): Promise<IntakeProgress> {
    const client = this.ensureSupabaseAdmin();

    const { data: published, error: publishedError } = await client
      .from('products')
      .select('id')
      .eq('status', PUBLISHED_STATUS);

    if (publishedError) {
      console.error('[SerialisedAssetService] Error al contar productos publicados:', {
        error: publishedError,
      });
      throw publishedError;
    }

    const { data: assets, error: assetsError } = await client
      .from('serialised_assets')
      .select('product_id');

    if (assetsError) {
      console.error('[SerialisedAssetService] Error al contar equipos serializados:', {
        error: assetsError,
      });
      throw assetsError;
    }

    const publishedRows = (published as { id: number }[]) || [];
    const assetRows = (assets as { product_id: number }[]) || [];
    const publishedIds = new Set(publishedRows.map((row) => row.id));

    // Assets against an unpublished (or draft) product are real, but they do not move a progress
    // bar whose denominator is the published catalogue.
    const coveredIds = new Set(
      assetRows.map((row) => row.product_id).filter((id) => publishedIds.has(id))
    );

    const publishedProducts = publishedIds.size;
    const productsWithAssets = coveredIds.size;

    return {
      published_products: publishedProducts,
      products_with_assets: productsWithAssets,
      total_assets: assetRows.length,
      completion_percentage:
        publishedProducts === 0 ? 0 : Math.round((productsWithAssets / publishedProducts) * 100),
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Units (migration 0021). Written against the 0021 contract; the migration is not applied yet.
  // ---------------------------------------------------------------------------------------------

  /**
   * `as any`: the 0021 columns and tables (`wear`, `row_version`, `location_id`,
   * `warehouse_locations`, `asset_current_state`) are not in the generated `Database` type yet.
   * Same reasoning as `AssetMovementService.ensureSupabaseAdmin`.
   */
  private static untypedClient(): any {
    return this.ensureSupabaseAdmin() as any;
  }

  /**
   * Edits one unit under optimistic concurrency: the UPDATE matches `id` AND the `row_version` the
   * editor read, and the DB trigger bumps the version. Zero rows means either the unit is gone
   * (404) or someone saved first (409, the editor must reload). Location is not editable here:
   * a move goes through `AssetRelocationService.relocateAsset` so it leaves an audit row.
   */
  static async updateAsset(id: number, rawPatch: unknown, expectedRowVersion: number): Promise<InventoryUnit> {
    if (!Number.isInteger(id) || id <= 0) throw new InventoryError(UNIT_ERRORS.INVALID_ID, 400);
    if (!isValidRowVersion(expectedRowVersion)) throw new InventoryError(UNIT_ERRORS.ROW_VERSION_REQUIRED, 400);
    const patch = sanitizeUnitPatch(rawPatch);

    const { data, error } = await this.untypedClient()
      .from('serialised_assets')
      .update(patch)
      .eq('id', id)
      .eq('row_version', expectedRowVersion)
      .select(UNIT_COLUMNS)
      .maybeSingle();

    if (error) {
      const { code, message } = error as { code?: string; message?: string };
      if (code === UNIQUE_VIOLATION && (message || '').includes(SERIAL_UNIQUE_INDEX)) {
        throw new InventoryError(UNIT_ERRORS.SERIAL_TAKEN, 409);
      }
      console.error('[SerialisedAssetService] Error al actualizar la unidad:', { id, error });
      throw error;
    }
    if (!data) await this.throwMissingOrConflict(id);

    console.log('[SerialisedAssetService] Unidad actualizada:', { id, fields: Object.keys(patch) });
    return data as InventoryUnit;
  }

  /**
   * Archives a unit (condition `retired`). Never DELETE: movements and relocations reference the
   * row, and the count history needs it. Refused while the unit is out on a rental.
   */
  static async archiveAsset(id: number, expectedRowVersion: number): Promise<InventoryUnit> {
    if (!Number.isInteger(id) || id <= 0) throw new InventoryError(UNIT_ERRORS.INVALID_ID, 400);
    if (!isValidRowVersion(expectedRowVersion)) throw new InventoryError(UNIT_ERRORS.ROW_VERSION_REQUIRED, 400);

    const client = this.untypedClient();
    const { data: open, error: stateError } = await client
      .from('asset_current_state')
      .select('asset_id, order_id, direction')
      .eq('asset_id', id)
      .eq('direction', 'checkout')
      .maybeSingle();
    if (stateError) {
      console.error('[SerialisedAssetService] Error al leer el estado de la unidad:', { id, error: stateError });
      throw stateError;
    }
    if (open) throw new InventoryError(UNIT_ERRORS.IN_RENTAL, 409);

    const { data, error } = await client
      .from('serialised_assets')
      .update({ condition: 'retired' })
      .eq('id', id)
      .eq('row_version', expectedRowVersion)
      .select(UNIT_COLUMNS)
      .maybeSingle();
    if (error) {
      console.error('[SerialisedAssetService] Error al archivar la unidad:', { id, error });
      throw error;
    }
    if (!data) await this.throwMissingOrConflict(id);

    console.log('[SerialisedAssetService] Unidad archivada:', { id });
    return data as InventoryUnit;
  }

  /** After a guarded UPDATE matched nothing: 404 if the row is gone, 409 if its version moved on. */
  private static async throwMissingOrConflict(id: number): Promise<never> {
    const { data, error } = await this.untypedClient()
      .from('serialised_assets')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.error('[SerialisedAssetService] Error al verificar la unidad:', { id, error });
      throw error;
    }
    if (!data) throw new InventoryError(UNIT_ERRORS.NOT_FOUND, 404);
    throw new InventoryError(UNIT_ERRORS.CONFLICT, 409);
  }

  /**
   * Registers `count` units of one product in a single INSERT (all or nothing). Tags continue
   * from the highest assigned (`nextAssetTag`); serials come from the optional prefix or are the
   * tag itself (see `planBulkUnits`). Two intakes racing for the same tags: the second INSERT hits
   * the tag UNIQUE index and is answered with a retryable 409.
   */
  static async bulkCreateAssets(
    productId: number,
    count: number,
    defaults: BulkUnitDefaults = {}
  ): Promise<InventoryUnit[]> {
    if (!Number.isInteger(productId) || productId <= 0) throw new InventoryError(UNIT_ERRORS.PRODUCT_INVALID, 400);
    const condition = defaults.condition ?? 'operational';
    assertEditableCondition(condition);
    const wear = defaults.wear ?? 'used';
    if (!isUnitWear(wear)) throw new InventoryError(UNIT_ERRORS.INVALID_WEAR, 400);
    const prefix = normalizeSerialPrefix(defaults.serial_prefix);
    const locationId =
      typeof defaults.location_id === 'string' && defaults.location_id.trim() ? defaults.location_id.trim() : null;
    const freeText = typeof defaults.location === 'string' ? defaults.location.trim() : '';
    if (!locationId && !freeText) throw new InventoryError(UNIT_ERRORS.LOCATION_REQUIRED, 400);
    // Validates the count before any query.
    planBulkUnits({ highestTag: null, count, serialPrefix: prefix });

    const client = this.untypedClient();

    const { data: product, error: productError } = await client
      .from('products')
      .select('id')
      .eq('id', productId)
      .maybeSingle();
    if (productError) {
      console.error('[SerialisedAssetService] Error al verificar el producto:', { productId, error: productError });
      throw productError;
    }
    if (!product) throw new InventoryError(UNIT_ERRORS.PRODUCT_NOT_FOUND, 404);

    let locationLabel = freeText;
    if (locationId) {
      const { data: location, error: locationError } = await client
        .from('warehouse_locations')
        .select('id, code, name, is_active')
        .eq('id', locationId)
        .maybeSingle();
      if (locationError) {
        console.error('[SerialisedAssetService] Error al leer la ubicación:', { locationId, error: locationError });
        throw locationError;
      }
      if (!location) throw new InventoryError(LOCATION_ERRORS.NOT_FOUND, 404);
      if (!location.is_active) throw new InventoryError(LOCATION_ERRORS.INACTIVE, 400);
      locationLabel = describeLocation(location);
    }

    const plan = planBulkUnits({ highestTag: await this.getHighestAssetTag(), count, serialPrefix: prefix });

    // Serial uniqueness is case- and space-insensitive (`lower(btrim(serial))`), so read every
    // serial sharing the generated prefix and compare keys here, in one round trip.
    const likePrefix = `${(prefix ?? 'MH').replace(/([\\%_])/g, '\\$1')}-%`;
    const { data: existing, error: serialError } = await client
      .from('serialised_assets')
      .select('serial_number')
      .ilike('serial_number', likePrefix);
    if (serialError) {
      console.error('[SerialisedAssetService] Error al verificar números de serie:', { productId, error: serialError });
      throw serialError;
    }
    const taken = new Set(
      ((existing as Array<{ serial_number: string }>) || []).map((row) => serialKey(row.serial_number))
    );
    const collisions = plan
      .filter((unit) => taken.has(serialKey(unit.serial_number)))
      .map((unit) => unit.serial_number);
    if (collisions.length > 0) {
      throw new InventoryError(`${UNIT_ERRORS.BULK_SERIAL_TAKEN}: ${collisions.join(', ')}`, 409);
    }

    const kitCode = typeof defaults.kit_code === 'string' && defaults.kit_code.trim() ? defaults.kit_code.trim() : null;
    const notes = typeof defaults.notes === 'string' && defaults.notes.trim() ? defaults.notes.trim() : null;
    const rows = plan.map((unit) => ({
      product_id: productId,
      asset_tag: unit.asset_tag,
      serial_number: unit.serial_number,
      condition,
      wear,
      location: locationLabel,
      location_id: locationId,
      kit_code: kitCode,
      notes,
    }));

    const { data, error } = await client.from('serialised_assets').insert(rows).select(UNIT_COLUMNS);
    if (error) {
      const { code, message } = error as { code?: string; message?: string };
      if (code === UNIQUE_VIOLATION && (message || '').includes(ASSET_TAG_UNIQUE_INDEX)) {
        throw new InventoryError(UNIT_ERRORS.TAG_RACE, 409);
      }
      if (code === UNIQUE_VIOLATION && (message || '').includes(SERIAL_UNIQUE_INDEX)) {
        throw new InventoryError(UNIT_ERRORS.BULK_SERIAL_TAKEN, 409);
      }
      console.error('[SerialisedAssetService] Error en el ingreso masivo:', { productId, count, error });
      throw error;
    }

    console.log('[SerialisedAssetService] Ingreso masivo registrado:', {
      productId,
      count: rows.length,
      firstTag: rows[0]?.asset_tag,
      lastTag: rows[rows.length - 1]?.asset_tag,
    });
    return (data as InventoryUnit[]) || [];
  }

  /**
   * Every unit of a product (archived included; the UI filters), ordered by tag, with its derived
   * status and its structured location. "En arriendo" comes from `asset_current_state` (0012).
   */
  static async listByProduct(productId: number): Promise<InventoryUnitView[]> {
    if (!Number.isInteger(productId) || productId <= 0) throw new InventoryError(UNIT_ERRORS.PRODUCT_INVALID, 400);
    const client = this.untypedClient();

    const { data, error } = await client
      .from('serialised_assets')
      .select(`${UNIT_COLUMNS}, warehouse_locations (id, code, name, kind)`)
      .eq('product_id', productId)
      .order('asset_tag', { ascending: true });
    if (error) {
      console.error('[SerialisedAssetService] Error al listar las unidades del producto:', { productId, error });
      throw error;
    }

    type Row = InventoryUnit & { warehouse_locations?: InventoryUnitView['location_detail'] };
    const rows = (data as Row[]) || [];
    if (rows.length === 0) return [];

    const { data: openRows, error: stateError } = await client
      .from('asset_current_state')
      .select('asset_id, order_id')
      .in(
        'asset_id',
        rows.map((row) => row.id)
      )
      .eq('direction', 'checkout');
    if (stateError) {
      console.error('[SerialisedAssetService] Error al leer el estado de las unidades:', {
        productId,
        error: stateError,
      });
      throw stateError;
    }
    const openOrderByAsset = new Map<number, number>();
    for (const row of (openRows as Array<{ asset_id: number; order_id: number }>) || []) {
      openOrderByAsset.set(row.asset_id, row.order_id);
    }

    return rows.map(({ warehouse_locations: location, ...unit }) => {
      const openOrderId = openOrderByAsset.get(unit.id) ?? null;
      const status = deriveUnitStatus(unit.condition, openOrderId !== null);
      return {
        ...unit,
        status,
        open_order_id: status === 'in_rental' ? openOrderId : null,
        location_detail: location ?? null,
      };
    });
  }
}
