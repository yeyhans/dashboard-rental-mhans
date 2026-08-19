/**
 * Serialised inventory (M6). Types live here rather than in `src/types/database.ts` because that
 * file is generated from the live schema and is currently stale; regenerating it is out of scope
 * for this batch and would touch every service that imports it.
 */

/**
 * Physical condition of one unit. English tokens are the stored values (matching the CHECK
 * constraint in `0004_serialised_assets.sql`); the Spanish labels are UI-only.
 *
 * This is condition, not availability: a unit out on rental is still `operational`. Booking state
 * belongs to the availability capability, which ships separately.
 */
export const ASSET_CONDITIONS = [
  'operational',
  'maintenance',
  'cleaning',
  'damaged',
  'retired',
] as const;

export type AssetCondition = (typeof ASSET_CONDITIONS)[number];

export const ASSET_CONDITION_LABELS: Record<AssetCondition, string> = {
  operational: 'Operativo',
  maintenance: 'En mantención',
  cleaning: 'En limpieza',
  damaged: 'Dañado',
  retired: 'Fuera de servicio',
};

export interface SerialisedAsset {
  id: number;
  product_id: number;
  serial_number: string;
  condition: AssetCondition;
  location: string;
  kit_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SerialisedAssetInput {
  product_id: number;
  serial_number: string;
  condition: AssetCondition;
  location: string;
  kit_code?: string | null;
  notes?: string | null;
}

/** The five fields the migration-volume audit found missing across the catalogue. */
export const AUDITED_PRODUCT_FIELDS = ['sku', 'brands', 'type', 'status', 'stock_status'] as const;

export type AuditedProductField = (typeof AUDITED_PRODUCT_FIELDS)[number];

export const AUDITED_PRODUCT_FIELD_LABELS: Record<AuditedProductField, string> = {
  sku: 'SKU',
  brands: 'Marca',
  type: 'Tipo',
  status: 'Estado',
  stock_status: 'Stock',
};

export interface IncompleteProduct {
  id: number;
  name: string | null;
  slug: string | null;
  status: string | null;
  missing_fields: AuditedProductField[];
}

export interface DataQualityReport {
  /** Products examined. */
  total: number;
  incomplete: number;
  products: IncompleteProduct[];
}

/**
 * Physical-count progress (ADR-003 / O-5). Deliberately expressed as products covered rather than
 * assets entered: "how many models have we started counting" is the question the client's
 * dependency is tracked against, and an asset total alone cannot answer it.
 */
export interface IntakeProgress {
  published_products: number;
  products_with_assets: number;
  total_assets: number;
  completion_percentage: number;
}

/** Product fields the intake UI needs; a subset of `products`, all nullable by design. */
export interface IntakeProduct {
  id: number;
  name: string | null;
  slug: string | null;
  sku: string | null;
  brands: string | null;
  type: string | null;
  status: string | null;
  stock_status: string | null;
}
