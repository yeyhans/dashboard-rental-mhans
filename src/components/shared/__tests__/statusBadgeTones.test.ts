import { describe, expect, it } from "vitest";
import {
  badgeDotClass,
  badgePillClass,
  BADGE_TONES,
  isBadgeTone,
} from "../statusBadgeTones";

describe("statusBadgeTones", () => {
  it("lists the five D-03 tones in order", () => {
    expect(BADGE_TONES).toEqual(["ok", "info", "warn", "crit", "neutral"]);
  });

  it("recognises a valid tone and rejects anything else", () => {
    expect(isBadgeTone("ok")).toBe(true);
    expect(isBadgeTone("muted")).toBe(false);
    expect(isBadgeTone(undefined)).toBe(false);
  });

  it("returns a pill class referencing the matching semantic tokens", () => {
    expect(badgePillClass("ok")).toBe(
      "bg-[var(--color-ok-bg)] text-[var(--color-ok)]",
    );
    expect(badgePillClass("crit")).toBe(
      "bg-[var(--color-crit-bg)] text-[var(--color-crit)]",
    );
  });

  it("returns a dot class referencing the matching semantic token", () => {
    expect(badgeDotClass("info")).toBe("bg-[var(--color-info)]");
  });

  it("falls back to neutral for an unrecognised tone, same rule as statusTone in orderStatus.ts", () => {
    expect(badgePillClass("bogus")).toBe(badgePillClass("neutral"));
    expect(badgeDotClass("bogus")).toBe(badgeDotClass("neutral"));
  });
});
