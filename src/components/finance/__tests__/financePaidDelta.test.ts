import { describe, expect, it } from "vitest";
import { formatMonthDelta, paidMonthOverMonth } from "../financePaidDelta";

const now = new Date("2026-10-13T15:00:00.000Z");

describe("paidMonthOverMonth", () => {
  it("compares this month's collections with last month's", () => {
    const rows = [
      { paidAt: "2026-10-02T12:00:00Z", total: 300000 },
      { paidAt: "2026-10-05T12:00:00Z", total: 100000 },
      { paidAt: "2026-09-20T12:00:00Z", total: 200000 },
      { paidAt: "2026-08-20T12:00:00Z", total: 999999 },
      { paidAt: null, total: 50000 },
    ];
    // Oct: 400.000 in 2 orders (ticket 200.000); Sep: 200.000 in 1 (ticket 200.000).
    expect(paidMonthOverMonth(rows, now)).toEqual({
      cobrado: 100,
      pedidos: 100,
      ticket: 0,
    });
  });

  it("reads the month in Chile, not UTC", () => {
    // 2026-10-01T02:00Z is still 30 September in Santiago.
    const rows = [
      { paidAt: "2026-10-01T02:00:00Z", total: 100000 },
      { paidAt: "2026-10-10T12:00:00Z", total: 100000 },
    ];
    expect(paidMonthOverMonth(rows, now).cobrado).toBe(0);
  });

  it("has no delta without a previous month to compare", () => {
    expect(
      paidMonthOverMonth([{ paidAt: "2026-10-02T12:00:00Z", total: 1 }], now),
    ).toEqual({ cobrado: null, pedidos: null, ticket: null });
  });
});

describe("formatMonthDelta", () => {
  it("signs the change in Chilean format", () => {
    expect(formatMonthDelta(12.5)).toBe("+12,5% vs mes anterior");
    expect(formatMonthDelta(-3)).toBe("-3% vs mes anterior");
    expect(formatMonthDelta(0)).toBe("0% vs mes anterior");
  });

  it("says so when there is nothing to compare", () => {
    expect(formatMonthDelta(null)).toBe("Sin pagos el mes anterior");
  });
});
