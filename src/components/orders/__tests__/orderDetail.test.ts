import { describe, expect, it } from "vitest";
import {
  budgetVersions,
  clientLine,
  jornadasLabel,
  orderFinancialSummary,
  orderItemRows,
  orderPaymentSummary,
  orderPipelineSteps,
  rentalDateParts,
} from "../orderDetail";

describe("orderPipelineSteps", () => {
  it("lists the seven canon stages in chain order, without cancelled", () => {
    const steps = orderPipelineSteps("request");
    expect(steps.map((step) => step.label)).toEqual([
      "Solicitud",
      "Evaluación",
      "Confirmado",
      "Preparación",
      "En arriendo",
      "Devolución",
      "Completado",
    ]);
  });

  it("marks earlier stages done, the current one active and later ones pending", () => {
    const steps = orderPipelineSteps("preparation");
    expect(steps.map((step) => step.state)).toEqual([
      "done",
      "done",
      "done",
      "active",
      "pending",
      "pending",
      "pending",
    ]);
    expect(steps[3]?.number).toBe(4);
  });

  it("places a legacy status on its v1.2 stage", () => {
    // `processing` migrates to `confirmed`.
    const steps = orderPipelineSteps("processing");
    expect(steps[2]?.state).toBe("active");
  });

  it("appends a cancelled step and leaves the chain pending for a cancelled order", () => {
    const steps = orderPipelineSteps("cancelled");
    expect(steps).toHaveLength(8);
    expect(steps[7]).toMatchObject({ key: "cancelled", state: "cancelled" });
    expect(steps.slice(0, 7).every((step) => step.state === "pending")).toBe(
      true,
    );
  });

  it("shows every stage pending for an unknown status", () => {
    const steps = orderPipelineSteps("weird");
    expect(steps).toHaveLength(7);
    expect(steps.every((step) => step.state === "pending")).toBe(true);
  });
});

describe("orderItemRows", () => {
  it("prices each line as price x quantity x jornadas and sums the rental subtotal", () => {
    const result = orderItemRows(
      [
        { sku: "CAM-1", name: "Canon R5", quantity: 2, price: 10000 },
        { name: "Trípode", quantity: "1", price: "5000" },
      ],
      3,
    );
    expect(result.rows).toEqual([
      {
        sku: "CAM-1",
        name: "Canon R5",
        quantity: 2,
        unitPrice: 10000,
        subtotal: 60000,
      },
      {
        sku: "",
        name: "Trípode",
        quantity: 1,
        unitPrice: 5000,
        subtotal: 15000,
      },
    ]);
    expect(result.total).toBe(75000);
  });

  it("treats missing or zero jornadas as one", () => {
    expect(
      orderItemRows([{ name: "A", quantity: 1, price: 100 }], 0).total,
    ).toBe(100);
    expect(
      orderItemRows([{ name: "A", quantity: 1, price: 100 }], null).total,
    ).toBe(100);
  });
});

describe("budgetVersions", () => {
  it("splits the comma list newest first and flags the current version", () => {
    expect(budgetVersions(" a.pdf, b.pdf ,,c.pdf")).toEqual([
      { version: 3, url: "c.pdf", isCurrent: true },
      { version: 2, url: "b.pdf", isCurrent: false },
      { version: 1, url: "a.pdf", isCurrent: false },
    ]);
  });

  it("returns no versions for an empty value", () => {
    expect(budgetVersions(null)).toEqual([]);
    expect(budgetVersions("")).toEqual([]);
  });
});

describe("orderPaymentSummary", () => {
  it("computes the reserve and the pending balance for an unpaid order", () => {
    const summary = orderPaymentSummary({
      total: 100000,
      reserveType: "percent",
      reserveValue: 25,
      isPaid: false,
    });
    expect(summary).toEqual({
      reserveLabel: "Pago reserva 25%",
      reserveAmount: 25000,
      tag: "pendiente",
      balance: 75000,
      balanceTone: "crit",
    });
  });

  it("labels a fixed reserve and colours a balance under half the total as warn", () => {
    const summary = orderPaymentSummary({
      total: 100000,
      reserveType: "fixed",
      reserveValue: "60000",
      isPaid: false,
    });
    expect(summary.reserveLabel).toBe("Pago reserva (monto fijo)");
    expect(summary.balance).toBe(40000);
    expect(summary.balanceTone).toBe("warn");
  });

  it("clears the balance once the order is fully paid", () => {
    const summary = orderPaymentSummary({
      total: 100000,
      reserveType: "percent",
      reserveValue: 25,
      isPaid: true,
    });
    expect(summary.tag).toBe("pagado");
    expect(summary.balance).toBe(0);
    expect(summary.balanceTone).toBe("ok");
  });
});

describe("orderFinancialSummary", () => {
  it("reads the stored amounts as numbers, defaulting to zero", () => {
    expect(
      orderFinancialSummary(
        {
          calculated_subtotal: "90000",
          calculated_discount: 10000,
          shipping_total: null,
          calculated_iva: "17100",
          calculated_total: 107100,
        },
        100000,
      ),
    ).toEqual({
      productsSubtotal: 100000,
      discount: 10000,
      shipping: 0,
      net: 90000,
      iva: 17100,
      total: 107100,
    });
  });
});

describe("rentalDateParts", () => {
  it("formats a date column as DD/MM/YYYY with its weekday", () => {
    expect(rentalDateParts("2026-06-05")).toEqual({
      date: "05/06/2026",
      weekday: "Viernes",
    });
  });

  it("keeps an unparseable value and drops the weekday", () => {
    expect(rentalDateParts("pronto")).toEqual({ date: "pronto", weekday: "" });
    expect(rentalDateParts(null)).toEqual({ date: "—", weekday: "" });
  });
});

describe("labels", () => {
  it("pluralises jornadas", () => {
    expect(jornadasLabel(1)).toBe("1 jornada");
    expect(jornadasLabel("3")).toBe("3 jornadas");
    expect(jornadasLabel(null)).toBe("");
  });

  it("joins the client name and company, skipping blanks", () => {
    expect(clientLine("Ana Pérez", "Estudio Sur")).toBe(
      "Ana Pérez · Estudio Sur",
    );
    expect(clientLine("Ana Pérez", null)).toBe("Ana Pérez");
    expect(clientLine(" ", "")).toBe("");
  });
});
