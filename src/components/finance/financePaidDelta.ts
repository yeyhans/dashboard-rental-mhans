import { periodDelta } from "../../lib/finance";
import { businessDay } from "../../lib/businessDay";

export interface PaidMonthDelta {
  cobrado: number | null;
  pedidos: number | null;
  ticket: number | null;
}

/** `YYYY-MM` of a payment date in the business zone; a bare date is already a calendar day. */
function monthOf(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(0, 7);
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  return businessDay(instant).slice(0, 7);
}

function previousMonth(month: string): string {
  const [year, mm] = month.split("-").map(Number) as [number, number];
  return mm === 1
    ? `${year - 1}-12`
    : `${year}-${String(mm - 1).padStart(2, "0")}`;
}

/**
 * R-03a: the canon's "% vs mes anterior" on the three Pagados KPIs.
 *
 * Always this calendar month against the previous one, over every loaded paid row — not the
 * Período selector's window, which can be "Todo" and has no "previous" to compare with.
 */
export function paidMonthOverMonth(
  rows: ReadonlyArray<{ paidAt: string | null; total: number }>,
  now: Date,
): PaidMonthDelta {
  const current = businessDay(now).slice(0, 7);
  const previous = previousMonth(current);
  const sums = {
    [current]: { total: 0, count: 0 },
    [previous]: { total: 0, count: 0 },
  };

  for (const row of rows) {
    if (!row.paidAt) continue;
    const bucket = sums[monthOf(row.paidAt) ?? ""];
    if (!bucket) continue;
    bucket.total += row.total;
    bucket.count += 1;
  }

  const thisMonth = sums[current]!;
  const before = sums[previous]!;
  const ticket = (b: { total: number; count: number }) =>
    b.count > 0 ? b.total / b.count : 0;

  return {
    cobrado: periodDelta(thisMonth.total, before.total),
    pedidos: periodDelta(thisMonth.count, before.count),
    ticket: periodDelta(ticket(thisMonth), ticket(before)),
  };
}

export function formatMonthDelta(delta: number | null): string {
  if (delta === null) return "Sin pagos el mes anterior";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toLocaleString("es-CL")}% vs mes anterior`;
}
