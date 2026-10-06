import { describe, expect, it } from "vitest";
import {
  formatOrderDateWithWeekday,
  summarizeOrderProducts,
} from "../orderDateFormat";

describe("formatOrderDateWithWeekday", () => {
  it("formats a date-only string as dd/mm/yyyy followed by its Spanish weekday in parentheses", () => {
    // 2026-10-06 is a Tuesday.
    expect(formatOrderDateWithWeekday("2026-10-06")).toBe("06/10/2026 (Mar)");
  });

  it("formats a Monday correctly", () => {
    // 2026-10-05 is a Monday.
    expect(formatOrderDateWithWeekday("2026-10-05")).toBe("05/10/2026 (Lun)");
  });

  it("does not shift the day when given a full ISO datetime at UTC midnight", () => {
    expect(formatOrderDateWithWeekday("2026-10-06T00:00:00.000Z")).toBe(
      "06/10/2026 (Mar)",
    );
  });

  it("returns an empty string for an empty or missing value", () => {
    expect(formatOrderDateWithWeekday("")).toBe("");
    expect(formatOrderDateWithWeekday(null)).toBe("");
    expect(formatOrderDateWithWeekday(undefined)).toBe("");
  });

  it("returns an empty string for an invalid date", () => {
    expect(formatOrderDateWithWeekday("not-a-date")).toBe("");
  });

  it("covers every weekday abbreviation without duplicates", () => {
    const days = [
      "2026-10-04", // domingo
      "2026-10-05", // lunes
      "2026-10-06", // martes
      "2026-10-07", // miércoles
      "2026-10-08", // jueves
      "2026-10-09", // viernes
      "2026-10-10", // sábado
    ];
    const weekdays = days.map(
      (day) => /\((.+)\)$/.exec(formatOrderDateWithWeekday(day))?.[1],
    );
    expect(weekdays).toEqual(["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]);
  });
});

describe("summarizeOrderProducts", () => {
  const item = (name: string, quantity = 1) => ({
    name,
    quantity,
    product_id: 1,
    sku: "S",
    price: "1000",
  });

  it("returns an empty summary when there are no line items", () => {
    expect(summarizeOrderProducts([])).toEqual({ label: "", title: "" });
    expect(summarizeOrderProducts(null)).toEqual({ label: "", title: "" });
    expect(summarizeOrderProducts(undefined)).toEqual({ label: "", title: "" });
  });

  it("returns a value that is not an array as an empty summary", () => {
    expect(summarizeOrderProducts("[]")).toEqual({ label: "", title: "" });
    expect(summarizeOrderProducts({ name: "x" })).toEqual({
      label: "",
      title: "",
    });
  });

  it("shows only the product name for a single item", () => {
    expect(summarizeOrderProducts([item("Canon R5")])).toEqual({
      label: "Canon R5",
      title: "Canon R5",
    });
  });

  it("shows the first product name plus a +N counter for the rest", () => {
    const result = summarizeOrderProducts([
      item("Canon R5"),
      item("Profoto B10"),
      item("Manfrotto 055"),
    ]);
    expect(result.label).toBe("Canon R5 +2");
    expect(result.title).toBe("Canon R5, Profoto B10, Manfrotto 055");
  });

  it("skips entries without a usable name", () => {
    const result = summarizeOrderProducts([
      { name: "  " },
      null,
      item("Canon R5"),
      { quantity: 2 },
    ]);
    expect(result).toEqual({ label: "Canon R5", title: "Canon R5" });
  });
});
