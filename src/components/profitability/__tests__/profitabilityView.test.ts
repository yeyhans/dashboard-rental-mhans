import { describe, expect, it } from "vitest";
import { roiDisplay, PROFITABILITY_TABS } from "../profitabilityView";

describe("roiDisplay", () => {
  it("formats a ratio as a rounded percentage", () => {
    expect(roiDisplay(0.1092)).toBe("10.9%");
  });

  it("returns null instead of a 'sin datos' string when there is no acquisition cost recorded (D-11)", () => {
    // The canon empty-state rule (Q-5): no invented numbers, and no mono-figure placeholder
    // either — the caller renders an explicit empty state instead of a bare string.
    expect(roiDisplay(null)).toBeNull();
  });
});

describe("PROFITABILITY_TABS", () => {
  it("has the 4 canon tabs in canon order (D-11)", () => {
    expect(PROFITABILITY_TABS.map((t) => t.value)).toEqual([
      "resumen",
      "gastos",
      "activos",
      "inteligencia",
    ]);
  });

  it("uses the canon Spanish labels verbatim", () => {
    expect(PROFITABILITY_TABS.map((t) => t.label)).toEqual([
      "Resumen Económico",
      "Gastos Operacionales",
      "Activos e Inversiones",
      "Inteligencia de Activos",
    ]);
  });
});
