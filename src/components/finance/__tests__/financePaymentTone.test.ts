import { describe, expect, it } from "vitest";
import { financePaymentTone } from "../financePaymentTone";

describe("financePaymentTone", () => {
  it("marks an overdue row as crit, regardless of reserve state", () => {
    expect(financePaymentTone({ overdue: true, reservePaid: true })).toEqual({
      tone: "crit",
      label: "Vencido",
    });
    expect(financePaymentTone({ overdue: true, reservePaid: false })).toEqual({
      tone: "crit",
      label: "Vencido",
    });
  });

  it("marks a non-overdue row with the reserve paid as ok", () => {
    expect(financePaymentTone({ overdue: false, reservePaid: true })).toEqual({
      tone: "ok",
      label: "Reserva pagada",
    });
  });

  it("marks a non-overdue row without the reserve paid as warn", () => {
    expect(financePaymentTone({ overdue: false, reservePaid: false })).toEqual({
      tone: "warn",
      label: "Sin reserva",
    });
  });
});
