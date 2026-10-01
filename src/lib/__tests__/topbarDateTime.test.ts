import { describe, expect, it } from "vitest";
import { formatTopbarDateTime, msUntilNextMinute } from "../topbarDateTime";

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

describe("msUntilNextMinute (D-27 R3-source-only-behavior-tests)", () => {
  // Extracted out of Base.astro's inline script (R3-topbar-clock-drift) so the delay
  // computation itself — not just that the script calls `getSeconds`/`getMilliseconds` — has a
  // real, deterministic test instead of a source grep.
  it("returns the full 60000ms when called exactly on the minute boundary", () => {
    expect(msUntilNextMinute(new Date(2026, 5, 10, 9, 5, 0, 0))).toBe(60000);
  });

  it("returns the remaining milliseconds to the next minute", () => {
    expect(msUntilNextMinute(new Date(2026, 5, 10, 9, 5, 17, 0))).toBe(43000);
  });

  it("accounts for the millisecond component too", () => {
    expect(msUntilNextMinute(new Date(2026, 5, 10, 9, 5, 59, 750))).toBe(250);
  });

  it("never returns a value outside (0, 60000]", () => {
    for (let second = 0; second < 60; second++) {
      const ms = msUntilNextMinute(new Date(2026, 5, 10, 9, 5, second, 0));
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(60000);
    }
  });
});
