import { describe, expect, it } from "vitest";
import {
  OPERATOR_STATUS_ERRORS,
  operatorNextStatus,
  validateOperatorStatusChange,
} from "../operatorOrderStatus";

describe("operatorNextStatus: forward-only, one step", () => {
  it.each([
    ["confirmed", "preparation"],
    ["preparation", "in-rental"],
    ["in-rental", "return"],
  ])("%s -> %s", (from, to) => {
    expect(operatorNextStatus(from)).toBe(to);
  });

  it.each([
    "request",
    "evaluation",
    "return",
    "completed",
    "cancelled",
    "bogus",
    "",
    null,
    undefined,
  ])("offers no step from %s", (from) => {
    expect(operatorNextStatus(from as never)).toBeNull();
  });
});

describe("validateOperatorStatusChange", () => {
  it.each([
    ["confirmed", "preparation"],
    ["preparation", "in-rental"],
    ["in-rental", "return"],
  ])("allows %s -> %s", (from, to) => {
    expect(validateOperatorStatusChange(from, to)).toEqual({ valid: true });
  });

  it.each(["completed", "cancelled"])(
    "denies setting %s (admin only)",
    (to) => {
      for (const from of ["confirmed", "preparation", "in-rental", "return"]) {
        const result = validateOperatorStatusChange(from, to);
        expect(result.valid).toBe(false);
        expect(result.error).toBe(OPERATOR_STATUS_ERRORS.NOT_ALLOWED);
      }
    },
  );

  it.each([
    ["preparation", "confirmed"],
    ["in-rental", "preparation"],
    ["return", "in-rental"],
    ["return", "confirmed"],
    ["preparation", "preparation"],
  ])("denies going backwards or staying: %s -> %s", (from, to) => {
    expect(validateOperatorStatusChange(from, to).valid).toBe(false);
  });

  it.each([
    ["confirmed", "in-rental"],
    ["confirmed", "return"],
    ["preparation", "return"],
  ])("denies skipping a step: %s -> %s", (from, to) => {
    expect(validateOperatorStatusChange(from, to).valid).toBe(false);
  });

  it.each(["request", "evaluation", "return", "completed", "cancelled"])(
    "denies any change from %s",
    (from) => {
      expect(validateOperatorStatusChange(from, "preparation").valid).toBe(
        false,
      );
      expect(validateOperatorStatusChange(from, "in-rental").valid).toBe(false);
    },
  );

  it("fails closed on unknown values", () => {
    expect(validateOperatorStatusChange("weird", "preparation").valid).toBe(
      false,
    );
    expect(validateOperatorStatusChange("confirmed", "weird").valid).toBe(
      false,
    );
    expect(
      validateOperatorStatusChange(undefined as never, undefined as never)
        .valid,
    ).toBe(false);
  });
});
