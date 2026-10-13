import { describe, expect, it } from "vitest";
import { checkStatusChange } from "../orderTransitionGate";

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

  it("rejects a skipped stage with 409 and names the legal next step", () => {
    const rejection = checkStatusChange({
      from: "request",
      to: "completed",
      role: "admin",
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
      role: "admin",
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
