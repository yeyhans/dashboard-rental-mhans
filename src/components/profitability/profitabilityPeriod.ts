import { periodRangeFor, type PeriodKey } from "../../lib/periodRange";

/**
 * D-24 08d: filters a monthly series (`MonthlyRevenue[]`/`MonthlyMargin[]`, both shaped
 * `{ month: "YYYY-MM", ... }`) by the Rentabilidad period selector. Reuses `periodRangeFor`'s day
 * bounds, narrowed to the month, instead of a second period derivation.
 */
export function filterMonthlySeries<T extends { month: string }>(
  series: readonly T[],
  period: PeriodKey,
  now: Date,
): T[] {
  const range = periodRangeFor(period, now);
  if (range.start === null && range.end === null) return series.slice();

  const startMonth = range.start ? range.start.slice(0, 7) : null;
  const endMonth = range.end ? range.end.slice(0, 7) : null;

  return series.filter((point) => {
    if (startMonth && point.month < startMonth) return false;
    if (endMonth && point.month > endMonth) return false;
    return true;
  });
}
