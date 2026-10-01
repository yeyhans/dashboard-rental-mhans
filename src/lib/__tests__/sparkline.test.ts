import { describe, expect, it } from "vitest";
import { monthlyBucketSums, sparklinePoints } from "../sparkline";

describe("sparklinePoints", () => {
  it("returns an empty string for no values", () => {
    expect(sparklinePoints([])).toBe("");
  });

  it("renders a flat mid-height line for a single value", () => {
    expect(sparklinePoints([5], 10, 20)).toBe("0,10 10,10");
  });

  it("renders a flat mid-height line when every value is equal", () => {
    expect(sparklinePoints([3, 3, 3], 10, 20)).toBe("0,10 5,10 10,10");
  });

  it("maps the minimum to the bottom and the maximum to the top", () => {
    const points = sparklinePoints([0, 10], 10, 20);
    const [first, second] = points.split(" ");
    expect(first).toBe("0,20"); // min -> bottom (largest y)
    expect(second).toBe("10,0"); // max -> top (y = 0)
  });

  it("spaces x coordinates evenly across the width", () => {
    const points = sparklinePoints([1, 2, 3, 4], 30, 10);
    const xs = points.split(" ").map((p) => Number(p.split(",")[0]));
    expect(xs).toEqual([0, 10, 20, 30]);
  });
});

describe("monthlyBucketSums", () => {
  const NOW = new Date("2026-09-15T12:00:00.000Z"); // 2026-09 in America/Santiago

  it("returns one zero bucket per trailing month when there are no rows", () => {
    const sums = monthlyBucketSums(
      [],
      () => null,
      () => 0,
      NOW,
      3,
    );
    expect(sums).toEqual([0, 0, 0]);
  });

  it("sums values into the month they belong to, oldest first", () => {
    const rows = [
      { day: "2026-07-10", amount: 100 },
      { day: "2026-07-20", amount: 50 },
      { day: "2026-09-01", amount: 10 },
    ];
    const sums = monthlyBucketSums(
      rows,
      (r) => r.day,
      (r) => r.amount,
      NOW,
      3, // Jul, Aug, Sep
    );
    expect(sums).toEqual([150, 0, 10]);
  });

  it("ignores rows with no date and rows outside the window", () => {
    const rows = [
      { day: null, amount: 999 },
      { day: "2025-01-01", amount: 999 },
      { day: "2026-09-05", amount: 5 },
    ];
    const sums = monthlyBucketSums(
      rows,
      (r) => r.day,
      (r) => r.amount,
      NOW,
      2, // Aug, Sep
    );
    expect(sums).toEqual([0, 5]);
  });
});
