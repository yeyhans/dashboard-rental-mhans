import type { QuantityDiscrepancy } from '../lib/productValuation';

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
  /**
   * Internal tag `MH-00001`, pre-printed on the label roll and encoded in the label's QR and
   * Code 128 (`0009_asset_tags.sql`). Unique, never reused. Canonical form only — see
   * `src/lib/assetTag.ts`.
   */
  asset_tag: string;
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
  /** As scanned or typed; the service normalises and validates it. */
  asset_tag: string;
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

/**
 * One row of the data-quality list. A product lands here for either of two findings: an audited
 * field is blank (`missing_fields` non-empty) or its counted units disagree with — or were never
 * declared against — the client's spreadsheet (`discrepancy !== 'match'`).
 */
export interface IncompleteProduct {
  id: number;
  name: string | null;
  slug: string | null;
  /** "Numero serie" in the client's spreadsheet: the model code, not a per-unit serial. */
  sku: string | null;
  status: string | null;
  missing_fields: AuditedProductField[];
  /** "Cantidad": what the client declares owning. Null until entered. */
  declared_quantity: number | null;
  /** `count(serialised_assets)` for this product. */
  counted_quantity: number;
  market_value_clp: number | null;
  used_value_clp: number | null;
  /** Derived (`src/lib/productValuation.ts`), never stored. Null while a factor is unknown. */
  total_value_clp: number | null;
  discrepancy: QuantityDiscrepancy;
}

export interface DataQualityReport {
  /** Products examined. */
  total: number;
  /** Products with at least one finding (missing field or quantity discrepancy). */
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
  /** Client's count spreadsheet (0010). Null until entered. */
  declared_quantity: number | null;
  market_value_clp: number | null;
  used_value_clp: number | null;
}
