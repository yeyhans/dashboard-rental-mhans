import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SIZE, paginate, paginationLabel } from "../pagination";

const rows = Array.from({ length: 25 }, (_, i) => i + 1);

describe("paginate", () => {
  it("defaults to 10 rows per page", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(10);
    const page = paginate(rows, 1);
    expect(page.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(page.totalPages).toBe(3);
    expect(page.from).toBe(1);
    expect(page.to).toBe(10);
    expect(page.total).toBe(25);
  });

  it("returns the short last page", () => {
    const page = paginate(rows, 3);
    expect(page.items).toEqual([21, 22, 23, 24, 25]);
    expect(page.from).toBe(21);
    expect(page.to).toBe(25);
    expect(page.hasNext).toBe(false);
    expect(page.hasPrev).toBe(true);
  });

  it("clamps an out-of-range page, e.g. after filters shrink the list", () => {
    expect(paginate(rows, 99).page).toBe(3);
    expect(paginate(rows, 0).page).toBe(1);
    expect(paginate(rows, -4).page).toBe(1);
    expect(paginate(rows, Number.NaN).page).toBe(1);
  });

  it("handles an empty list as a single empty page", () => {
    const page = paginate([], 1);
    expect(page.items).toEqual([]);
    expect(page.totalPages).toBe(1);
    expect(page.from).toBe(0);
    expect(page.to).toBe(0);
    expect(page.hasNext).toBe(false);
    expect(page.hasPrev).toBe(false);
  });

  it("accepts a custom page size", () => {
    expect(paginate(rows, 2, 5).items).toEqual([6, 7, 8, 9, 10]);
  });
});

describe("paginationLabel", () => {
  it("formats the canon 'Mostrando 1 a 10 de N resultados' text", () => {
    expect(paginationLabel(paginate(rows, 1))).toBe(
      "Mostrando 1 a 10 de 25 resultados",
    );
    expect(paginationLabel(paginate(rows, 3))).toBe(
      "Mostrando 21 a 25 de 25 resultados",
    );
  });

  it("says there are no results for an empty list", () => {
    expect(paginationLabel(paginate([], 1))).toBe("Mostrando 0 resultados");
  });

  it("uses the singular for exactly one result", () => {
    expect(paginationLabel(paginate([1], 1))).toBe(
      "Mostrando 1 a 1 de 1 resultado",
    );
  });
});
