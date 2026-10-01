import { describe, expect, it } from "vitest";
import { filterMonthlySeries } from "../profitabilityPeriod";

const NOW = new Date("2026-09-15T12:00:00.000Z"); // business day 2026-09-15

const series = [
  { month: "2026-05", value: 1 },
  { month: "2026-06", value: 2 },
  { month: "2026-07", value: 3 },
  { month: "2026-08", value: 4 },
  { month: "2026-09", value: 5 },
];

describe("filterMonthlySeries", () => {
  it('"all" returns every point unchanged', () => {
    const result = filterMonthlySeries(series, "all", NOW);
    expect(result).toEqual(series);
  });

  it('"this-month" keeps only the current month', () => {
    const result = filterMonthlySeries(series, "this-month", NOW);
    expect(result.map((p) => p.month)).toEqual(["2026-09"]);
  });

  it('"last-month" keeps only the previous month', () => {
    const result = filterMonthlySeries(series, "last-month", NOW);
    expect(result.map((p) => p.month)).toEqual(["2026-08"]);
  });

  it('"this-year" keeps every month from January through the current one', () => {
    const result = filterMonthlySeries(series, "this-year", NOW);
    expect(result.map((p) => p.month)).toEqual([
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
  });

  it("returns a fresh array, not the same reference", () => {
    const result = filterMonthlySeries(series, "all", NOW);
    expect(result).not.toBe(series);
  });

  it('"last-90-days" clips the partial starting month instead of including it whole (D-27 R3-monthly-series-90d-whole-month)', () => {
    // periodRangeFor("last-90-days", NOW) starts 2026-06-18 — the 90-day window only covers
    // 13 of June's 30 days, so June must not appear as if it were a full month in the series.
    const result = filterMonthlySeries(series, "last-90-days", NOW);
    expect(result.map((p) => p.month)).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
  });

  it('"last-90-days" keeps a starting month that happens to fall on the 1st', () => {
    // A 90-day window anchored so its start lands exactly on a month's first day is NOT partial
    // and must be kept — the clip only drops months the window only partially covers.
    const now = new Date("2026-05-01T12:00:00.000Z"); // business day 2026-05-01
    const result = filterMonthlySeries(series, "last-90-days", now);
    expect(result.map((p) => p.month)).toContain("2026-05");
  });
});
