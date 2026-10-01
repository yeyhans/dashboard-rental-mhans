/**
 * Pedidos list date cells (D-22 02d): neutral ink with a weekday label, replacing the green/red
 * pair that colored a plain start/end date as if it were a status (there is no status attached
 * to "Inicio"/"Término" — the labels already say which is which).
 *
 * `order_fecha_inicio`/`order_fecha_termino` are `date` columns (no time component), so the
 * weekday is derived from the UTC calendar fields, mirroring `OrdersDashboard.tsx`'s own
 * `formatDate`: parsing with the local `Date` getters would shift the day at the UTC-4 boundary.
 */

const WEEKDAY_ABBR = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"] as const;

/**
 * `lun 06/10/2026` for a `YYYY-MM-DD` (or full ISO datetime) date string. Returns `""` when the
 * value is missing or does not parse, so callers can fall back to their own "sin fecha" copy.
 */
export function formatOrderDateWithWeekday(
  dateString: string | null | undefined,
): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  const weekday = WEEKDAY_ABBR[date.getUTCDay()];

  return `${weekday} ${day}/${month}/${year}`;
}
