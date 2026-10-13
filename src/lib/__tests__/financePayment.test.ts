import { describe, expect, it } from "vitest";
import {
  PAYMENT_DOCUMENT_MAX_LENGTH,
  paymentDate,
  paymentUpdateColumns,
  validatePaymentUpdate,
} from "../finance";

/**
 * R-03a: the Pago select, OC and Factura inputs of Finanzas & Cobranza write through
 * `PATCH /api/payments/[id]`. These are the pure rules behind that route.
 */
describe("validatePaymentUpdate", () => {
  it("accepts a boolean paid flag", () => {
    expect(validatePaymentUpdate({ paid: true })).toEqual({
      ok: true,
      update: { paid: true },
    });
    expect(validatePaymentUpdate({ paid: false })).toEqual({
      ok: true,
      update: { paid: false },
    });
  });

  it("rejects a paid flag that is not a boolean", () => {
    const result = validatePaymentUpdate({ paid: "true" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/estado de pago/i);
  });

  it("trims the documents and turns an empty value into null", () => {
    expect(
      validatePaymentUpdate({ purchaseOrder: "  OC-77 ", invoiceNumber: "" }),
    ).toEqual({
      ok: true,
      update: { purchaseOrder: "OC-77", invoiceNumber: null },
    });
    expect(validatePaymentUpdate({ invoiceNumber: null })).toEqual({
      ok: true,
      update: { invoiceNumber: null },
    });
  });

  it("caps the document length", () => {
    const long = "9".repeat(PAYMENT_DOCUMENT_MAX_LENGTH + 1);
    const oc = validatePaymentUpdate({ purchaseOrder: long });
    const invoice = validatePaymentUpdate({ invoiceNumber: long });
    expect(oc.ok).toBe(false);
    expect(invoice.ok).toBe(false);
    if (!oc.ok) expect(oc.error).toMatch(/orden de compra/i);
    if (!invoice.ok) expect(invoice.error).toMatch(/factura/i);
  });

  it("rejects documents that are not text", () => {
    expect(validatePaymentUpdate({ invoiceNumber: 123 }).ok).toBe(false);
  });

  it("rejects a body without any payment field", () => {
    expect(validatePaymentUpdate({}).ok).toBe(false);
    expect(validatePaymentUpdate({ status: "completed" }).ok).toBe(false);
    expect(validatePaymentUpdate(null).ok).toBe(false);
    expect(validatePaymentUpdate([true]).ok).toBe(false);
  });
});

describe("paymentUpdateColumns", () => {
  const now = new Date("2026-10-13T15:00:00.000Z");

  it("marks the order fully paid, with its reserve, and stamps date_paid", () => {
    expect(paymentUpdateColumns({ paid: true }, now)).toEqual({
      pago_completo: true,
      pago_reserva: true,
      date_paid: "2026-10-13T15:00:00.000Z",
    });
  });

  it("reverting clears date_paid but leaves the reserve as it was", () => {
    expect(paymentUpdateColumns({ paid: false }, now)).toEqual({
      pago_completo: false,
      date_paid: null,
    });
  });

  it("maps the documents to their columns", () => {
    expect(
      paymentUpdateColumns({ purchaseOrder: "OC-1", invoiceNumber: null }, now),
    ).toEqual({ orden_compra: "OC-1", numero_factura: null });
  });
});

describe("paymentDate", () => {
  it("prefers date_paid", () => {
    expect(
      paymentDate({
        datePaid: "2026-09-02T10:00:00Z",
        dateCompleted: "2026-09-01T10:00:00Z",
      }),
    ).toEqual({ date: "2026-09-02T10:00:00Z", source: "date_paid" });
  });

  it("falls back to date_completed, which is the only date older orders carry", () => {
    expect(
      paymentDate({ datePaid: null, dateCompleted: "2026-09-01T10:00:00Z" }),
    ).toEqual({ date: "2026-09-01T10:00:00Z", source: "date_completed" });
  });

  it("has no date when neither column is set", () => {
    expect(paymentDate({ datePaid: null, dateCompleted: null })).toEqual({
      date: null,
      source: null,
    });
  });
});
