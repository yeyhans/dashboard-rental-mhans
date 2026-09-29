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

  it("treats a non-empty string, a node and true as present", () => {
    expect(hasSlotContent("+3 esta semana")).toBe(true);
    expect(hasSlotContent(12)).toBe(true);
    expect(hasSlotContent(true)).toBe(true);
  });
});
