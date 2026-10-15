import { describe, expect, it } from "vitest";
import {
  checkStatusChange,
  isSequentialTransition,
  openCheckoutsRejection,
  parseStatusChangeOptions,
  requiresOpenCheckoutCheck,
} from "../orderTransitionGate";

describe("parseStatusChangeOptions", () => {
  it("defaults every flag to false", () => {
    expect(parseStatusChangeOptions({ status: "request" })).toEqual({
      notify: false,
      acknowledgeOpenCheckouts: false,
    });
  });

  it("only turns a flag on with a literal true", () => {
    expect(
      parseStatusChangeOptions({
        notify: "true",
        acknowledge_open_checkouts: 1,
      }),
    ).toEqual({ notify: false, acknowledgeOpenCheckouts: false });
    expect(
      parseStatusChangeOptions({ notify: true, acknowledge_open_checkouts: true }),
    ).toEqual({ notify: true, acknowledgeOpenCheckouts: true });
  });

  it("trims the reason and drops a blank one", () => {
    expect(parseStatusChangeOptions({ reason: "  sin stock " })).toMatchObject({
      reason: "sin stock",
    });
    expect(parseStatusChangeOptions({ reason: "   " })).not.toHaveProperty(
      "reason",
    );
  });

  it("rejects a reason that is not text or longer than 500 characters", () => {
    expect(parseStatusChangeOptions({ reason: 5 })).toHaveProperty("error");
    expect(
      parseStatusChangeOptions({ reason: "x".repeat(501) }),
    ).toHaveProperty("error");
    expect(
      parseStatusChangeOptions({ reason: "x".repeat(500) }),
    ).not.toHaveProperty("error");
  });
});

describe("openCheckoutsRejection", () => {
  it("names the tags and carries them as data", () => {
    const body = openCheckoutsRejection(["MH-00001", "MH-00002"]);
    expect(body).toMatchObject({
      success: false,
      code: "OPEN_CHECKOUTS",
      data: { asset_tags: ["MH-00001", "MH-00002"] },
    });
    expect(body.error).toContain("MH-00001, MH-00002");
  });
});

/**
 * The one transition gate both status-writing routes share (`PUT /api/orders/[id]/status` and
 * `PUT /api/orders/update/[id]`). Before, each route carried its own copy of these checks.
 */
describe("checkStatusChange", () => {
  it("allows the next stage for an admin", () => {
    expect(
      checkStatusChange({ from: "request", to: "evaluation", role: "admin" }),
    ).toBeNull();
  });

  it("allows cancelling from a non-terminal stage", () => {
    expect(
      checkStatusChange({ from: "confirmed", to: "cancelled", role: "admin" }),
    ).toBeNull();
  });

  // A role without the admin bypass (none is issued today, but an unknown role must fail closed)
  // still answers to the state machine.
  it("rejects a skipped stage with 409 and names the legal next step", () => {
    const rejection = checkStatusChange({
      from: "request",
      to: "completed",
      role: null,
    });
    expect(rejection).toEqual({
      status: 409,
      code: "INVALID_TRANSITION",
      error: expect.stringContaining("Transición de estado no permitida"),
    });
    expect(rejection?.error).toContain("Evaluación");
  });

  it("explains that a terminal status admits no change", () => {
    const rejection = checkStatusChange({
      from: "completed",
      to: "cancelled",
      role: null,
    });
    expect(rejection?.status).toBe(409);
    expect(rejection?.error).toContain("estado terminal");
  });

  it("rejects an operator change outside the bodega steps with 403", () => {
    expect(
      checkStatusChange({
        from: "confirmed",
        to: "cancelled",
        role: "operator",
      }),
    ).toEqual({
      status: 403,
      code: "OPERATOR_TRANSITION_FORBIDDEN",
      error: expect.any(String),
    });
  });

  it("lets an operator take the next bodega step", () => {
    expect(
      checkStatusChange({ from: "in-rental", to: "return", role: "operator" }),
    ).toBeNull();
  });

  it("does not judge a legacy origin the machine does not know", () => {
    expect(
      checkStatusChange({ from: "processing", to: "completed", role: "admin" }),
    ).toBeNull();
  });
});

describe("checkStatusChange — finalize flow (R-04b)", () => {
  it("lets an operator close a return when allowOperatorClosing is set", () => {
    expect(
      checkStatusChange({
        from: "return",
        to: "completed",
        role: "operator",
        allowOperatorClosing: true,
      }),
    ).toBeNull();
  });

  it("refuses it for an operator without the flag", () => {
    expect(
      checkStatusChange({ from: "return", to: "completed", role: "operator" })
        ?.status,
    ).toBe(403);
  });

  it("still applies the state machine with the flag", () => {
    expect(
      checkStatusChange({
        from: "in-rental",
        to: "completed",
        role: "operator",
        allowOperatorClosing: true,
      })?.status,
    ).toBe(403);
  });
});

/**
 * Admin status jump (2026-10-14, `odd/tasks/admin-status-jump.md`). admin and super_admin may move
 * an order from any status to any other, terminal states included; operators keep their
 * forward-only bodega steps.
 */
describe("checkStatusChange — admin jump", () => {
  it.each(["admin", "super_admin"])(
    "lets %s skip stages forward",
    (role) => {
      expect(
        checkStatusChange({ from: "request", to: "in-rental", role }),
      ).toBeNull();
    },
  );

  it("lets an admin move an order backwards", () => {
    expect(
      checkStatusChange({ from: "in-rental", to: "confirmed", role: "admin" }),
    ).toBeNull();
  });

  it.each([
    ["completed", "in-rental"],
    ["cancelled", "request"],
    ["completed", "cancelled"],
  ])("lets an admin leave the terminal status %s (to %s)", (from, to) => {
    expect(
      checkStatusChange({ from, to, role: "super_admin" }),
    ).toBeNull();
  });

  it("does not let an admin jump to a value outside the vocabulary", () => {
    expect(
      checkStatusChange({ from: "confirmed", to: "on-hold", role: "admin" })
        ?.code,
    ).toBe("INVALID_TRANSITION");
  });

  it("rejects re-sending the current status with 409 SAME_STATUS", () => {
    expect(
      checkStatusChange({ from: "confirmed", to: "confirmed", role: "admin" }),
    ).toEqual({
      status: 409,
      code: "SAME_STATUS",
      error: expect.stringContaining("ya está"),
    });
  });

  it("keeps the operator rule ahead of the admin bypass", () => {
    expect(
      checkStatusChange({
        from: "request",
        to: "in-rental",
        role: "operator",
      })?.code,
    ).toBe("OPERATOR_TRANSITION_FORBIDDEN");
  });
});

describe("isSequentialTransition", () => {
  it("is true for the next stage and for cancelling", () => {
    expect(isSequentialTransition("preparation", "in-rental")).toBe(true);
    expect(isSequentialTransition("evaluation", "cancelled")).toBe(true);
  });

  it("is false for a skip, a step back or leaving a terminal state", () => {
    expect(isSequentialTransition("request", "confirmed")).toBe(false);
    expect(isSequentialTransition("return", "in-rental")).toBe(false);
    expect(isSequentialTransition("completed", "return")).toBe(false);
  });

  it("is false for values outside the vocabulary", () => {
    expect(isSequentialTransition("on-hold", "request")).toBe(false);
    expect(isSequentialTransition(undefined, "request")).toBe(false);
  });
});

describe("requiresOpenCheckoutCheck", () => {
  it.each(["completed", "cancelled"])(
    "checks open checkouts when closing the order as %s",
    (to) => {
      expect(requiresOpenCheckoutCheck("in-rental", to)).toBe(true);
      expect(requiresOpenCheckoutCheck("request", to)).toBe(true);
    },
  );

  it.each(["request", "evaluation", "confirmed", "preparation"])(
    "checks open checkouts when an order out on rent goes back to %s",
    (to) => {
      expect(requiresOpenCheckoutCheck("in-rental", to)).toBe(true);
      expect(requiresOpenCheckoutCheck("return", to)).toBe(true);
    },
  );

  it("does not check the normal in-rental -> return step", () => {
    expect(requiresOpenCheckoutCheck("in-rental", "return")).toBe(false);
    expect(requiresOpenCheckoutCheck("return", "in-rental")).toBe(false);
  });

  it("does not check moves among the pre-rental stages", () => {
    expect(requiresOpenCheckoutCheck("preparation", "confirmed")).toBe(false);
    expect(requiresOpenCheckoutCheck("request", "in-rental")).toBe(false);
  });
});
