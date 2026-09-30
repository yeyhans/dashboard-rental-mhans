import { describe, expect, it } from "vitest";
import { formatOrderDateWithWeekday } from "../orderDateFormat";

describe("formatOrderDateWithWeekday", () => {
  it("formats a date-only string with its Spanish weekday abbreviation", () => {
    // 2026-10-06 is a Tuesday.
    expect(formatOrderDateWithWeekday("2026-10-06")).toBe("mar 06/10/2026");
  });

  it("formats a Monday correctly", () => {
    // 2026-10-05 is a Monday.
    expect(formatOrderDateWithWeekday("2026-10-05")).toBe("lun 05/10/2026");
  });

  it("does not shift the day when given a full ISO datetime at UTC midnight", () => {
    expect(formatOrderDateWithWeekday("2026-10-06T00:00:00.000Z")).toBe(
      "mar 06/10/2026",
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
      (day) => formatOrderDateWithWeekday(day).split(" ")[0],
    );
    expect(weekdays).toEqual(["dom", "lun", "mar", "mié", "jue", "vie", "sáb"]);
  });
});
