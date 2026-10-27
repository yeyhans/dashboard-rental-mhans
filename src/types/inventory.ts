import type { QuantityDiscrepancy } from "../lib/productValuation";

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
  "operational",
  "maintenance",
  "cleaning",
  "damaged",
  "retired",
] as const;

export type AssetCondition = (typeof ASSET_CONDITIONS)[number];

export const ASSET_CONDITION_LABELS: Record<AssetCondition, string> = {
  operational: "Operativo",
  maintenance: "En mantención",
  cleaning: "En limpieza",
  damaged: "Dañado",
  retired: "Fuera de servicio",
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
export const AUDITED_PRODUCT_FIELDS = [
  "sku",
  "brands",
  "type",
  "status",
  "stock_status",
] as const;

export type AuditedProductField = (typeof AUDITED_PRODUCT_FIELDS)[number];

export const AUDITED_PRODUCT_FIELD_LABELS: Record<AuditedProductField, string> =
  {
    sku: "SKU",
    brands: "Marca",
    type: "Tipo",
    status: "Estado",
    stock_status: "Stock",
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

// ================================================================================================
// BEGIN SHARED INVENTORY CONTRACT (migrations 0021 and 0023) — copied verbatim by mariohans-3d-ops.
// Self-contained on purpose: no imports. Stored values are English tokens mirroring the CHECK
// constraints in `supabase/migrations/0021_warehouse_units_locations.sql` (asserted by its test);
// Spanish labels are UI-only and follow canon RC2.1.3 (Catálogo de Equipos, Check-In).
// ================================================================================================

/**
 * Stored condition of a unit (0021 adds `blocked`). Availability is NOT a condition: a unit with
 * an open checkout is "En arriendo" whatever its condition, derived from `asset_current_state`.
 */
export const UNIT_CONDITIONS = [
  "operational",
  "maintenance",
  "cleaning",
  "damaged",
  "blocked",
  "retired",
] as const;

export type UnitCondition = (typeof UNIT_CONDITIONS)[number];

export const UNIT_CONDITION_LABELS_ES: Record<UnitCondition, string> = {
  operational: "Disponible",
  maintenance: "Mantención",
  cleaning: "Limpieza",
  damaged: "Dañado",
  blocked: "Bloqueado",
  retired: "Archivado",
};

/** Label for the derived state (open checkout). Never stored. */
export const UNIT_IN_RENTAL_LABEL_ES = "En arriendo";

/** Display status of a unit: its condition, or `in_rental` when it has an open checkout. */
export type UnitDisplayStatus = UnitCondition | "in_rental";

export const UNIT_WEARS = ["new", "used"] as const;

export type UnitWear = (typeof UNIT_WEARS)[number];

export const WEAR_LABELS_ES: Record<UnitWear, string> = {
  new: "Nuevo",
  used: "Usado",
};

export const LOCATION_KINDS = [
  "shelf",
  "level",
  "box",
  "floor",
  "rug",
] as const;

export type LocationKind = (typeof LOCATION_KINDS)[number];

export const LOCATION_KIND_LABELS_ES: Record<LocationKind, string> = {
  shelf: "Estante",
  level: "Nivel",
  box: "Caja",
  floor: "Piso",
  rug: "Alfombra",
};

/** Wall of the 5x5 m room; `C` is the center (the rug). */
export const WALLS = ["N", "E", "S", "W", "C"] as const;

export type Wall = (typeof WALLS)[number];

export const WALL_LABELS_ES: Record<Wall, string> = {
  N: "Muro norte",
  E: "Muro este",
  S: "Muro sur",
  W: "Muro oeste",
  C: "Centro",
};

/** Same pattern as the `warehouse_locations.code` CHECK: N-E2, N-E2-L3, S-CJ4, C-ALF. */
export const LOCATION_CODE_PATTERN = /^[NESWC]-[A-Z0-9]+(-[A-Z0-9]+)*$/;

/** Room size in meters; positions are measured from the top-left corner. */
export const WAREHOUSE_ROOM_SIZE_M = 5;

export const ROTATIONS_DEG = [0, 90, 180, 270] as const;

export type RotationDeg = (typeof ROTATIONS_DEG)[number];

/**
 * One row of `warehouse_locations`. Hierarchy: level -> shelf; box -> shelf | level | floor | rug
 * or no parent; shelf/floor/rug are roots. numeric(5,2) columns arrive as numbers from PostgREST.
 */
export interface WarehouseLocation {
  id: string;
  code: string;
  name: string;
  kind: LocationKind;
  parent_id: string | null;
  wall: Wall | null;
  pos_x: number | null;
  pos_y: number | null;
  width: number | null;
  depth: number | null;
  height: number | null;
  level_index: number | null;
  rotation_deg: RotationDeg;
  is_active: boolean;
  /** Optimistic concurrency: send the version you read; the DB bumps it on every update. */
  row_version: number;
  created_at: string;
  updated_at: string;
  /** `admin_users.user_id` (auth uuid) of the last editor. */
  updated_by: string | null;
}

export const RELOCATION_SOURCES = ["dashboard", "ops", "mcp"] as const;

export type RelocationSource = (typeof RELOCATION_SOURCES)[number];

/**
 * One row of `asset_relocations` (append-only). Inserting a row performs the move; the DB raises
 * SQLSTATE `PT409` (HTTP 409) when the unit is no longer at `from_location_id`.
 */
export interface AssetRelocation {
  id: number;
  asset_id: number;
  from_location_id: string | null;
  to_location_id: string;
  /** `admin_users.user_id` (auth uuid). */
  moved_by_admin_id: string | null;
  moved_at: string;
  source: RelocationSource;
  notes: string | null;
}

/** SQLSTATE raised by the relocation trigger on a stale `from_location_id`. */
export const RELOCATION_CONFLICT_SQLSTATE = "PT409";

export const INCIDENT_TYPES = [
  "physical_damage",
  "missing_part",
  "moisture",
  "electrical_failure",
  "cosmetic_wear",
  "not_returned",
  "other",
] as const;

export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_LABELS_ES: Record<IncidentType, string> = {
  physical_damage: "Daño físico visible",
  missing_part: "Pieza o accesorio faltante",
  moisture: "Daño por humedad",
  electrical_failure: "Falla eléctrica",
  cosmetic_wear: "Rayón o desgaste estético",
  not_returned: "No devuelto",
  other: "Otro",
};

/**
 * One row of the `product_unit_counts` view. Buckets are exclusive for non-retired units:
 * total = available + in_rental + maintenance + damaged + blocked. `maintenance` includes cleaning.
 */
export interface ProductUnitCounts {
  product_id: number;
  total: number;
  available: number;
  in_rental: number;
  maintenance: number;
  damaged: number;
  blocked: number;
  retired: number;
}

/** A `serialised_assets` row with the 0021 and 0023 columns. */
export interface InventoryUnit {
  id: number;
  product_id: number;
  asset_tag: string;
  serial_number: string;
  condition: UnitCondition;
  wear: UnitWear;
  /** Derived "CODE · Name" when `location_id` is set; free text otherwise (legacy). */
  location: string;
  location_id: string | null;
  kit_code: string | null;
  notes: string | null;
  /** Costo de adquisición de esta unidad, en CLP. */
  acquisition_cost: number | null;
  /** Fecha de compra de la unidad (ISO 8601). */
  purchase_date: string | null;
  /** Precio de mercado de la unidad, en CLP. Semilla desde products.market_value_clp. */
  market_price: number | null;
  row_version: number;
  created_at: string;
  updated_at: string;
}

// ================================================================================================
// END SHARED INVENTORY CONTRACT
// ================================================================================================
