import { describe, expect, it } from "vitest";
import {
  matchesPaymentFilter,
  PAYMENT_FILTER_OPTIONS,
} from "../financePaymentFilter";

describe("PAYMENT_FILTER_OPTIONS", () => {
  it('starts with "Todos"', () => {
    expect(PAYMENT_FILTER_OPTIONS[0]).toEqual({ value: "all", label: "Todos" });
  });
});

describe("matchesPaymentFilter", () => {
  it('"all" matches every row', () => {
    expect(
      matchesPaymentFilter({ overdue: true, reservePaid: false }, "all"),
    ).toBe(true);
    expect(
      matchesPaymentFilter({ overdue: false, reservePaid: true }, "all"),
    ).toBe(true);
  });

  it('"overdue" matches only overdue rows, regardless of reserve', () => {
    expect(
      matchesPaymentFilter({ overdue: true, reservePaid: true }, "overdue"),
    ).toBe(true);
    expect(
      matchesPaymentFilter({ overdue: false, reservePaid: true }, "overdue"),
    ).toBe(false);
  });

  it('"reserve-paid" matches reserve-paid rows that are not overdue', () => {
    expect(
      matchesPaymentFilter(
        { overdue: false, reservePaid: true },
        "reserve-paid",
      ),
    ).toBe(true);
    expect(
      matchesPaymentFilter(
        { overdue: true, reservePaid: true },
        "reserve-paid",
      ),
    ).toBe(false);
    expect(
      matchesPaymentFilter(
        { overdue: false, reservePaid: false },
        "reserve-paid",
      ),
    ).toBe(false);
  });

  it('"no-reserve" matches rows with no reserve paid and not overdue', () => {
    expect(
      matchesPaymentFilter(
        { overdue: false, reservePaid: false },
        "no-reserve",
      ),
    ).toBe(true);
    expect(
      matchesPaymentFilter({ overdue: true, reservePaid: false }, "no-reserve"),
    ).toBe(false);
    expect(
      matchesPaymentFilter({ overdue: false, reservePaid: true }, "no-reserve"),
    ).toBe(false);
  });
});
