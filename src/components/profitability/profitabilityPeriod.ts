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
  // D-27 (R3-monthly-series-90d-whole-month): `range.start` is a day, not a month boundary.
  // "Últimos 90 días" anchors on `now - 89 days`, which almost never lands on the 1st, so the
  // bucket for `startMonth` only covers a few of that month's days. Keeping it as a full point
  // would silently count an entire month's worth of a chart axis for a sliver of real data. Every
  // other period ("Este mes", "Mes anterior", "Año") always starts on the 1st, so this only ever
  // clips something for "Últimos 90 días".
  const startMonthIsPartial = !!range.start && !range.start.endsWith("-01");

  return series.filter((point) => {
    if (startMonth) {
      if (point.month < startMonth) return false;
      if (point.month === startMonth && startMonthIsPartial) return false;
    }
    if (endMonth && point.month > endMonth) return false;
    return true;
  });
}
