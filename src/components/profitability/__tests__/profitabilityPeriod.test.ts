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
});
