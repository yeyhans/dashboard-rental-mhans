import type { BadgeTone } from "./shared/statusBadgeTones";
import { stockLabel } from "../lib/catalogAvailability";

/**
 * Tone mapping for the D-08 canon Stock column (`StatusBadge`), replacing the split-pill
 * `StockStatusBadge` that only carried a bare Spanish label with no semantic dot.
 */
export function productStockTone(status: string | null | undefined): BadgeTone {
  switch (status) {
    case "instock":
      return "ok";
    case "outofstock":
      return "crit";
    case "onbackorder":
      return "warn";
    default:
      return "neutral";
  }
}

const KNOWN_STOCK_STATUSES = new Set(["instock", "outofstock", "onbackorder"]);

/**
 * Same fallback rule the table already used: a missing status reads as `outofstock`. A present
 * but unrecognised status (D-16 finding) no longer echoes the raw DB value into the Spanish UI —
 * it reads as "Sin definir" instead.
 */
export function productStockBadgeLabel(
  status: string | null | undefined,
): string {
  if (status && !KNOWN_STOCK_STATUSES.has(status)) return "Sin definir";
  return stockLabel(status ?? "outofstock");
}
