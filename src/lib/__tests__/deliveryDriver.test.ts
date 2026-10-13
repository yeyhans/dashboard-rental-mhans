import { describe, expect, it } from "vitest";
import {
  ALL_DRIVERS,
  DRIVER_NAME_MAX_LENGTH,
  NO_DRIVER,
  driverNameOptions,
  matchesDriverFilter,
  normalizeDriverName,
} from "../delivery";

/**
 * R-06: the driver (conductor) of a shipment, free text in `shipping_usage.driver_name`
 * (migration 0017). Validated on the server: trimmed, at most 80 characters, empty clears it.
 */
describe("normalizeDriverName", () => {
  it("trims and accepts a name", () => {
    expect(normalizeDriverName("  Carlos R.  ")).toEqual({
      ok: true,
      value: "Carlos R.",
    });
  });

  it("collapses inner runs of whitespace", () => {
    expect(normalizeDriverName("Juan    P.")).toEqual({
      ok: true,
      value: "Juan P.",
    });
  });

  it("treats empty, blank and null as clearing the driver", () => {
    expect(normalizeDriverName("")).toEqual({ ok: true, value: null });
    expect(normalizeDriverName("   ")).toEqual({ ok: true, value: null });
    expect(normalizeDriverName(null)).toEqual({ ok: true, value: null });
  });

  it("accepts exactly the maximum length", () => {
    const name = "a".repeat(DRIVER_NAME_MAX_LENGTH);
    expect(normalizeDriverName(name)).toEqual({ ok: true, value: name });
  });

  it("rejects a name longer than the maximum", () => {
    const result = normalizeDriverName("a".repeat(DRIVER_NAME_MAX_LENGTH + 1));
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toContain("80");
  });

  it("rejects a non-string value", () => {
    expect(normalizeDriverName(42).ok).toBe(false);
    expect(normalizeDriverName(undefined).ok).toBe(false);
  });
});

describe("driverNameOptions", () => {
  it("lists distinct driver names, sorted, without blanks", () => {
    expect(
      driverNameOptions([
        { driverName: "Juan P." },
        { driverName: null },
        { driverName: "Carlos R." },
        { driverName: "Juan P." },
      ]),
    ).toEqual(["Carlos R.", "Juan P."]);
  });
});

describe("matchesDriverFilter", () => {
  it("keeps every row for the 'all drivers' option", () => {
    expect(matchesDriverFilter({ driverName: null }, ALL_DRIVERS)).toBe(true);
  });

  it("matches a named driver exactly", () => {
    expect(matchesDriverFilter({ driverName: "Juan P." }, "Juan P.")).toBe(
      true,
    );
    expect(matchesDriverFilter({ driverName: "Carlos R." }, "Juan P.")).toBe(
      false,
    );
  });

  it("selects the rows with no driver assigned", () => {
    expect(matchesDriverFilter({ driverName: null }, NO_DRIVER)).toBe(true);
    expect(matchesDriverFilter({ driverName: "Juan P." }, NO_DRIVER)).toBe(
      false,
    );
  });
});
