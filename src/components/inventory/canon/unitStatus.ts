import {
  UNIT_CONDITION_LABELS_ES,
  UNIT_IN_RENTAL_LABEL_ES,
  type ProductUnitCounts,
  type UnitDisplayStatus,
} from "../../../types/inventory";

/**
 * Canon RC2.1.3 (Área 01) status vocabulary for units and per-product stock.
 *
 * Local on purpose: the shared `StatusBadge`/`globals.css`/`tailwind.config.mjs` belong to another
 * work stream, so the canon tokens live here as Tailwind arbitrary values. When the shared canon
 * variants land, `UnitStatusPill` can delegate to them without touching its callers.
 */
export type CanonTone = "ok" | "info" | "warn" | "crit" | "neutral";

/** `.badge.<tone>` of the canon: tinted background + status ink. */
export const CANON_TONE_CLASSES: Record<CanonTone, string> = {
  ok: "bg-[#E7F2EC] text-[#256B44]",
  info: "bg-[#EAF0FA] text-[#2E5490]",
  warn: "bg-[#FBF3DE] text-[#8A6A1E]",
  crit: "bg-[#FBEEEC] text-[#A3271F]",
  neutral: "bg-[#F7F7F6] text-[#666666]",
};

/** Status ink alone, for KPI values and icons. */
export const CANON_TONE_TEXT: Record<CanonTone, string> = {
  ok: "text-[#256B44]",
  info: "text-[#2E5490]",
  warn: "text-[#8A6A1E]",
  crit: "text-[#A3271F]",
  neutral: "text-[#666666]",
};

const UNIT_STATUS_TONES: Record<UnitDisplayStatus, CanonTone> = {
  operational: "ok",
  in_rental: "info",
  maintenance: "warn",
  cleaning: "warn",
  damaged: "crit",
  blocked: "crit",
  retired: "neutral",
};

export function unitStatusTone(status: UnitDisplayStatus): CanonTone {
  return UNIT_STATUS_TONES[status];
}

export function unitStatusLabel(status: UnitDisplayStatus): string {
  return status === "in_rental" ? UNIT_IN_RENTAL_LABEL_ES : UNIT_CONDITION_LABELS_ES[status];
}

/** Overall stock state of a product in the catalog list. */
export type ProductInventoryStatus = "available" | "in_rental" | "maintenance" | "blocked" | "no_units";

export const PRODUCT_INVENTORY_STATUS: Record<ProductInventoryStatus, { label: string; tone: CanonTone }> = {
  available: { label: "Disponible", tone: "ok" },
  in_rental: { label: "En arriendo", tone: "info" },
  maintenance: { label: "Mantención", tone: "warn" },
  blocked: { label: "Bloqueado", tone: "crit" },
  no_units: { label: "Sin unidades", tone: "neutral" },
};

/**
 * Same precedence as the canon's `computeCounts`: any damaged/blocked unit flags the product,
 * then maintenance, then "En arriendo" only when nothing is left on the shelf.
 */
export function productInventoryStatus(counts: ProductUnitCounts): ProductInventoryStatus {
  if (counts.total === 0) return "no_units";
  if (counts.damaged + counts.blocked > 0) return "blocked";
  if (counts.maintenance > 0) return "maintenance";
  if (counts.available === 0 && counts.in_rental > 0) return "in_rental";
  return "available";
}
