import { InventoryError } from '../lib/inventoryUnits';
import { supabaseAdmin } from '../lib/supabase';
import type { ProductUnitCounts } from '../types/inventory';

export const COUNTS_MAX_PRODUCT_IDS = 200;

export const COUNTS_ERRORS = {
  INVALID_IDS: 'Los IDs de producto deben ser enteros positivos',
  TOO_MANY: `Puedes consultar hasta ${COUNTS_MAX_PRODUCT_IDS} productos a la vez`,
} as const;

const COUNT_COLUMNS = 'product_id, total, available, in_rental, maintenance, damaged, blocked, retired';

function zeroCounts(productId: number): ProductUnitCounts {
  return { product_id: productId, total: 0, available: 0, in_rental: 0, maintenance: 0, damaged: 0, blocked: 0, retired: 0 };
}

/**
 * Stock / Disp. / En arriendo per product, read from the `product_unit_counts` view (0021). The
 * view does the bucketing (total = available + in_rental + maintenance + damaged + blocked); this
 * service only selects rows for the products on screen and keeps the caller's order.
 *
 * Written against the 0021 contract; the view does not exist in any database yet.
 */
export class ProductUnitCountsService {
  /** `as any`: `product_unit_counts` is not in the generated `Database` type yet. */
  private static client(): any {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available');
    }
    return supabaseAdmin as any;
  }

  /**
   * One row per distinct requested id, in request order. An id the view does not return (an
   * unknown product) comes back as zeros, so the list can render without a second lookup.
   */
  static async getByProductIds(productIds: readonly number[]): Promise<ProductUnitCounts[]> {
    if (productIds.some((id) => !Number.isInteger(id) || id <= 0)) throw new InventoryError(COUNTS_ERRORS.INVALID_IDS, 400);
    const ids = [...new Set(productIds)];
    if (ids.length === 0) return [];
    if (ids.length > COUNTS_MAX_PRODUCT_IDS) throw new InventoryError(COUNTS_ERRORS.TOO_MANY, 400);

    const { data, error } = await this.client().from('product_unit_counts').select(COUNT_COLUMNS).in('product_id', ids);
    if (error) {
      console.error('[ProductUnitCountsService] Error al leer los conteos de unidades:', { count: ids.length, error });
      throw error;
    }

    const byId = new Map<number, ProductUnitCounts>();
    for (const row of (data as ProductUnitCounts[]) || []) byId.set(row.product_id, row);
    return ids.map((id) => byId.get(id) ?? zeroCounts(id));
  }
}

export default ProductUnitCountsService;
