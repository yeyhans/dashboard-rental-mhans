import { describe, expect, it } from "vitest";
import {
  filterByPeriod,
  isDayWithinRange,
  periodRangeFor,
  PERIOD_OPTIONS,
} from "../periodRange";

// 2026-09-15 12:00 UTC is 2026-09-15 09:00 in America/Santiago (UTC-3 in September, DST).
const NOW = new Date("2026-09-15T12:00:00.000Z");

describe("PERIOD_OPTIONS", () => {
  it("matches the canon labels in order", () => {
    expect(PERIOD_OPTIONS.map((o) => o.label)).toEqual([
      "Este mes",
      "Mes anterior",
      "Últimos 90 días",
      "Año",
      "Todo",
    ]);
  });
});

describe("periodRangeFor", () => {
  it('"all" is unbounded', () => {
    expect(periodRangeFor("all", NOW)).toEqual({ start: null, end: null });
  });

  it('"this-month" starts the 1st of the business-zone current month, ends today', () => {
    expect(periodRangeFor("this-month", NOW)).toEqual({
      start: "2026-09-01",
      end: "2026-09-15",
    });
  });

  it('"last-month" spans the full previous calendar month', () => {
    expect(periodRangeFor("last-month", NOW)).toEqual({
      start: "2026-08-01",
      end: "2026-08-31",
    });
  });

  it('"last-90-days" ends today and starts 89 days earlier', () => {
    const range = periodRangeFor("last-90-days", NOW);
    expect(range.end).toBe("2026-09-15");
    expect(range.start).toBe("2026-06-18");
  });

  it('"this-year" starts January 1st, ends today', () => {
    expect(periodRangeFor("this-year", NOW)).toEqual({
      start: "2026-01-01",
      end: "2026-09-15",
    });
  });

  it("anchors on the business-zone day, not the server's UTC day", () => {
    // 02:00 UTC on 2026-09-01 is still 2026-08-31 23:00 in Santiago.
    const lateNightUtc = new Date("2026-09-01T02:00:00.000Z");
    expect(periodRangeFor("this-month", lateNightUtc).end).toBe("2026-08-31");
  });
});

describe("isDayWithinRange", () => {
  const range = { start: "2026-09-01", end: "2026-09-15" };

  it("accepts a day inside the range", () => {
    expect(isDayWithinRange("2026-09-10", range)).toBe(true);
  });

  it("rejects a day before the start or after the end", () => {
    expect(isDayWithinRange("2026-08-31", range)).toBe(false);
    expect(isDayWithinRange("2026-09-16", range)).toBe(false);
  });

  it("rejects a missing day inside a bounded range", () => {
    expect(isDayWithinRange(null, range)).toBe(false);
  });

  it("accepts a missing day under an unbounded range", () => {
    expect(isDayWithinRange(null, { start: null, end: null })).toBe(true);
  });

  it("truncates a full ISO datetime to its calendar day", () => {
    expect(isDayWithinRange("2026-09-10T23:00:00.000Z", range)).toBe(true);
  });
});

describe("filterByPeriod", () => {
  const rows = [
    { id: 1, day: "2026-09-05" },
    { id: 2, day: "2026-09-20" },
    { id: 3, day: null },
  ];

  it("keeps every row, including ones with no date, for an unbounded range", () => {
    const result = filterByPeriod(
      rows,
      { start: null, end: null },
      (r) => r.day,
    );
    expect(result).toHaveLength(3);
    // A fresh copy, not the same array reference.
    expect(result).not.toBe(rows);
  });

  it("drops rows outside a bounded range and rows with no date", () => {
    const result = filterByPeriod(
      rows,
      { start: "2026-09-01", end: "2026-09-10" },
      (r) => r.day,
    );
    expect(result.map((r) => r.id)).toEqual([1]);
  });
});
