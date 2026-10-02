import React from "react";
import { describe, expect, it } from "vitest";
import { BudgetDocument } from "../budget/BudgetDocument";
import {
  budgetFixtures,
  collectText,
  longNamedOrder,
  plainOrder,
  renderToBufferForTest,
  shortOrder,
} from "../../__tests__/fixtures";

type Data = Parameters<typeof BudgetDocument>[0]["data"];
const element = (data: Data) => React.createElement(BudgetDocument, { data });

describe("BudgetDocument render smoke", () => {
  for (const [name, data] of Object.entries(budgetFixtures)) {
    it(`renders the "${name}" fixture to a valid PDF`, async () => {
      const buffer = await renderToBufferForTest(element(data));
      expect(buffer.subarray(0, 4).toString("latin1")).toBe("%PDF");
      expect(buffer.byteLength).toBeGreaterThan(10_000);
    }, 30_000);
  }

  it("flows the 18-item order onto more than one page", async () => {
    const buffer = await renderToBufferForTest(element(longNamedOrder));
    const pages = buffer.toString("latin1").match(/\/Type \/Page\b/g) ?? [];
    expect(pages.length).toBeGreaterThan(1);
  }, 30_000);
});

describe("BudgetDocument copy", () => {
  const text = (data: Data) => collectText(element(data)).join("|").toLowerCase();

  it("prints the redesigned header and sections, without the old IMPORTANTE/Estado", () => {
    const out = text(shortOrder);
    expect(out).toContain("pedido #420");
    expect(out).toContain("presupuesto de arriendo");
    expect(out).toContain("fecha: 16-05-2026");
    expect(out).toContain("información de cliente");
    expect(out).toContain("información de reserva");
    expect(out).toContain("equipos solicitados");
    expect(out).toContain("datos de transferencia");
    expect(out).toContain("aceptación de condiciones");
    expect(out).toContain("saldo pendiente");
    expect(out).not.toContain("importante");
    expect(out).not.toContain("estado");
  });

  it("hides the discount row, shipping row and note when empty", () => {
    const out = text(plainOrder);
    expect(out).not.toContain("descuento");
    expect(out).not.toContain("móvil rental");
    expect(out).not.toContain("nota");
  });

  it("shows discount with percentage, shipping, note and retire name when present", () => {
    const out = text(longNamedOrder);
    expect(out).toContain("descuento 10%");
    expect(out).toContain("móvil rental");
    expect(out).toContain("nota");
    expect(out).toContain("matías alejandro soto pérez");
  });

  it("uses the order reserve label in the reserve box and in the terms", () => {
    const out = text(shortOrder);
    expect(out).toContain("reserva 25%");
    expect(out).toContain("abono de reserva 25%");
  });
});
