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

/** Same fallback rule the table already used: a missing status reads as `outofstock`. */
export function productStockBadgeLabel(
  status: string | null | undefined,
): string {
  return stockLabel(status ?? "outofstock");
}
