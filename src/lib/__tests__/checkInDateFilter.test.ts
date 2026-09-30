import { describe, expect, it } from "vitest";
import { checkInBandTitle, filterByReturnDate } from "../checkInDateFilter";

describe("filterByReturnDate", () => {
  const entries = [
    { id: 1, endDate: "2026-09-30" },
    { id: 2, endDate: "2026-10-01" },
    { id: 3, endDate: null },
  ];

  it("returns every entry when the filter is empty", () => {
    expect(filterByReturnDate(entries, "")).toEqual(entries);
  });

  it("keeps only entries whose endDate matches the filter day exactly", () => {
    expect(filterByReturnDate(entries, "2026-09-30")).toEqual([entries[0]]);
  });

  it("excludes entries with a null endDate when a filter day is set", () => {
    expect(filterByReturnDate(entries, "2026-10-05")).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const copy = [...entries];
    filterByReturnDate(entries, "");
    expect(entries).toEqual(copy);
  });
});

describe("checkInBandTitle", () => {
  it('returns "Devoluciones hoy" when the filter day is today', () => {
    expect(checkInBandTitle("2026-09-30", "2026-09-30")).toBe(
      "Devoluciones hoy",
    );
  });

  it('returns "Devoluciones" when there is no filter', () => {
    expect(checkInBandTitle("", "2026-09-30")).toBe("Devoluciones");
  });

  it('returns "Devoluciones" when the filter day is not today (includes overdue)', () => {
    expect(checkInBandTitle("2026-09-15", "2026-09-30")).toBe("Devoluciones");
  });
});
