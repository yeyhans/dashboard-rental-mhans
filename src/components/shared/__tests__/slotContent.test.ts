import { describe, expect, it } from "vitest";
import { hasSlotContent } from "../slotContent";

describe("hasSlotContent", () => {
  it("treats undefined, null, false and an empty string as absent", () => {
    expect(hasSlotContent(undefined)).toBe(false);
    expect(hasSlotContent(null)).toBe(false);
    expect(hasSlotContent(false)).toBe(false);
    expect(hasSlotContent("")).toBe(false);
  });

  it("treats a numeric 0 as present", () => {
    expect(hasSlotContent(0)).toBe(true);
  });

  it("treats a non-empty string and a node as present", () => {
    expect(hasSlotContent("+3 esta semana")).toBe(true);
    expect(hasSlotContent(12)).toBe(true);
  });

  it("treats true as absent, since React renders nothing for it (D-19)", () => {
    expect(hasSlotContent(true)).toBe(false);
  });
});
