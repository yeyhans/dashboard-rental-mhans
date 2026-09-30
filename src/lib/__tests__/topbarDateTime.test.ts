import { describe, expect, it } from "vitest";
import { formatTopbarDateTime } from "../topbarDateTime";

describe("formatTopbarDateTime", () => {
  it("formats the date as weekday, day de Month de year (es-CL)", () => {
    // 2026-06-10 is a Wednesday.
    const { date } = formatTopbarDateTime(new Date(2026, 5, 10, 10, 42));
    expect(date).toBe("Miércoles, 10 de Junio de 2026");
  });

  it("formats the time as 24h HH:MM with leading zeros", () => {
    const { time } = formatTopbarDateTime(new Date(2026, 5, 10, 9, 5));
    expect(time).toBe("09:05");
  });

  it("does not add a leading zero to the day of month", () => {
    const { date } = formatTopbarDateTime(new Date(2026, 0, 1, 0, 0));
    expect(date).toBe("Jueves, 1 de Enero de 2026");
  });

  it("pads midnight correctly", () => {
    const { time } = formatTopbarDateTime(new Date(2026, 0, 1, 0, 0));
    expect(time).toBe("00:00");
  });
});
