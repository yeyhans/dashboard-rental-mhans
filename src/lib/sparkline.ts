/**
 * KpiCard sparkline (D-24 07d): a tiny inline SVG trend line, no new chart dependency.
 */

import { businessDay } from "./businessDay";

/**
 * `points` attribute for a `<polyline>` spanning `width`x`height`, normalized to the min/max of
 * `values`. A flat series (including a single value) renders as a horizontal mid-height line
 * rather than dividing by a zero range.
 */
export function sparklinePoints(
  values: readonly number[],
  width = 56,
  height = 18,
): string {
  if (values.length === 0) return "";
  if (values.length === 1) {
    const y = height / 2;
    return `0,${y} ${width},${y}`;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const stepX = width / (values.length - 1);

  return values
    .map((value, index) => {
      const x = Math.round(index * stepX * 100) / 100;
      const y =
        range === 0
          ? height / 2
          : Math.round((height - ((value - min) / range) * height) * 100) / 100;
      return `${x},${y}`;
    })
    .join(" ");
}

/**
 * Sums `valueOf(row)` into one bucket per trailing calendar month (business zone), oldest first
 * — the per-period buckets a KpiCard sparkline is fed from, computed over data the board already
 * loaded rather than a new query. Months with nothing are `0`, same convention as
 * `monthlyRevenueSeries` (a chart that drops empty months compresses the axis).
 */
export function monthlyBucketSums<T>(
  rows: readonly T[],
  dateOf: (row: T) => string | null | undefined,
  valueOf: (row: T) => number,
  now: Date,
  months = 6,
): number[] {
  const [y, m] = businessDay(now).split("-").map(Number) as [number, number];
  const buckets = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    const key = new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7);
    buckets.set(key, 0);
  }

  for (const row of rows) {
    const day = dateOf(row);
    if (!day) continue;
    const key = day.slice(0, 7);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + valueOf(row));
    }
  }

  return [...buckets.values()];
}
