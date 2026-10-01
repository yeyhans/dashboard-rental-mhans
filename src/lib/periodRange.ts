/**
 * Period selector (D-24 07c/08d): "Este mes" / "Mes anterior" / "Últimos 90 días" / "Año" /
 * "Todo", matching the canon labels. All boundaries are calendar days in the business zone
 * (`businessDay`, America/Santiago) anchored on `now`, never the server's UTC day — same R3-104/
 * R3-105 convention `businessDay.ts` and `lib/profitability.ts` already follow.
 */

import { businessDay } from "./businessDay";

export type PeriodKey =
  | "this-month"
  | "last-month"
  | "last-90-days"
  | "this-year"
  | "all";

export const PERIOD_OPTIONS: ReadonlyArray<{
  value: PeriodKey;
  label: string;
}> = [
  { value: "this-month", label: "Este mes" },
  { value: "last-month", label: "Mes anterior" },
  { value: "last-90-days", label: "Últimos 90 días" },
  { value: "this-year", label: "Año" },
  { value: "all", label: "Todo" },
];

/** Inclusive day bounds, `YYYY-MM-DD`. `null` on either side means unbounded. */
export interface DayRange {
  readonly start: string | null;
  readonly end: string | null;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isoDay(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** The day range for `period`, anchored on the business-zone calendar day of `now`. */
export function periodRangeFor(period: PeriodKey, now: Date): DayRange {
  const today = businessDay(now);
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];

  switch (period) {
    case "all":
      return { start: null, end: null };
    case "this-month":
      return { start: isoDay(y, m, 1), end: today };
    case "last-month": {
      const start = `${new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7)}-01`;
      // Day 0 of the current month is the last day of the previous one.
      const end = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
      return { start, end };
    }
    case "last-90-days": {
      const start = new Date(Date.UTC(y, m - 1, d - 89))
        .toISOString()
        .slice(0, 10);
      return { start, end: today };
    }
    case "this-year":
      return { start: isoDay(y, 1, 1), end: today };
  }
}

/** Whether `day` (`YYYY-MM-DD` or a longer ISO string) falls inside `range`, inclusive. */
export function isDayWithinRange(
  day: string | null | undefined,
  range: DayRange,
): boolean {
  if (range.start === null && range.end === null) return true;
  if (!day) return false;
  const value = day.slice(0, 10);
  if (range.start && value < range.start) return false;
  if (range.end && value > range.end) return false;
  return true;
}

/**
 * Filters `rows` to `range`, reading each row's relevant date through `dateOf`. An unbounded
 * range ("Todo") returns every row — including ones whose date is missing — rather than running
 * them through `isDayWithinRange`, which would otherwise drop them.
 */
export function filterByPeriod<T>(
  rows: readonly T[],
  range: DayRange,
  dateOf: (row: T) => string | null | undefined,
): T[] {
  if (range.start === null && range.end === null) return rows.slice();
  return rows.filter((row) => isDayWithinRange(dateOf(row), range));
}
