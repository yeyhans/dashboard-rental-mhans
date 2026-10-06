/**
 * Pedidos list cell formatters.
 *
 * Dates (D-22 02d, D-3 02.5): neutral ink with a weekday label, replacing the green/red pair that
 * colored a plain start/end date as if it were a status (there is no status attached to
 * "Inicio"/"Término" — the labels already say which is which). Canon shape: `05/06/2026 (Vie)`.
 *
 * `order_fecha_inicio`/`order_fecha_termino` are `date` columns (no time component), so the
 * weekday is derived from the UTC calendar fields, mirroring `OrdersDashboard.tsx`'s own
 * `formatDate`: parsing with the local `Date` getters would shift the day at the UTC-4 boundary.
 *
 * Products (D-3 02.4): the canon "Productos" column summarises `orders.line_items`.
 */

const WEEKDAY_ABBR = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

/**
 * `06/10/2026 (Mar)` for a `YYYY-MM-DD` (or full ISO datetime) date string. Returns `""` when the
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

  return `${day}/${month}/${year} (${weekday})`;
}

export interface OrderProductsSummary {
  /** Cell text: the first product name, plus `+N` when the order has more. `""` when none. */
  label: string;
  /** Tooltip text: every product name, comma separated. `""` when none. */
  title: string;
}

/**
 * Summary of an order's `line_items` for a table cell. `line_items` is a jsonb column, so the
 * input is untrusted: anything that is not an array, and entries without a usable `name`, are
 * ignored instead of throwing.
 */
export function summarizeOrderProducts(
  lineItems: unknown,
): OrderProductsSummary {
  if (!Array.isArray(lineItems)) return { label: "", title: "" };

  const names = lineItems
    .map((item) =>
      item && typeof item === "object" && "name" in item
        ? (item as { name: unknown }).name
        : null,
    )
    .filter(
      (name): name is string => typeof name === "string" && name.trim() !== "",
    )
    .map((name) => name.trim());

  if (names.length === 0) return { label: "", title: "" };

  const [first, ...rest] = names;
  return {
    label: rest.length > 0 ? `${first} +${rest.length}` : first!,
    title: names.join(", "),
  };
}
