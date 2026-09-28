import { describe, expect, it } from "vitest";
import { financeRowsToCsv } from "../financeExport";
import type { FinanceRow } from "../../../services/financeService";

function makeRow(overrides: Partial<FinanceRow> = {}): FinanceRow {
  return {
    id: 1,
    reference: "#0001",
    client: "Ana Pérez",
    project: "Sesión producto",
    status: "processing",
    total: 100000,
    reserve: 25000,
    outstanding: 75000,
    collected: 25000,
    reservePaid: true,
    fullyPaid: false,
    overdue: false,
    endDate: "2026-09-10",
    paidAt: null,
    purchaseOrder: null,
    invoiceNumber: null,
    ...overrides,
  };
}

describe("financeRowsToCsv — pendientes", () => {
  it("returns the canon header row for pendientes", () => {
    const csv = financeRowsToCsv([], "pendientes");
    expect(csv.split("\n")[0]).toBe(
      "ID Pedido,Cliente,Proyecto,Total,Reserva,Saldo Pendiente,OC,Factura,Estado",
    );
  });

  it("formats one pendientes row with plain numbers and the payment state label", () => {
    const csv = financeRowsToCsv([makeRow()], "pendientes");
    const [, line] = csv.split("\n");
    expect(line).toBe(
      "#0001,Ana Pérez,Sesión producto,100000,25000,75000,—,—,Reserva pagada",
    );
  });

  it("escapes a field containing a comma", () => {
    const csv = financeRowsToCsv(
      [makeRow({ client: "Pérez, Ana" })],
      "pendientes",
    );
    const [, line] = csv.split("\n");
    expect(line).toContain('"Pérez, Ana"');
  });

  it("labels an overdue row as Vencido", () => {
    const csv = financeRowsToCsv([makeRow({ overdue: true })], "pendientes");
    expect(csv).toContain("Vencido");
  });
});

describe("financeRowsToCsv — pagados", () => {
  it("returns the canon header row for pagados", () => {
    const csv = financeRowsToCsv([], "pagados");
    expect(csv.split("\n")[0]).toBe(
      "ID Pedido,Cliente,Proyecto,Fecha Pago,Total,OC,Factura",
    );
  });

  it("formats the paid date as DD/MM/YYYY", () => {
    const csv = financeRowsToCsv(
      [
        makeRow({
          paidAt: "2026-03-05",
          purchaseOrder: "OC-9",
          invoiceNumber: "F-9",
        }),
      ],
      "pagados",
    );
    const [, line] = csv.split("\n");
    expect(line).toBe(
      "#0001,Ana Pérez,Sesión producto,05/03/2026,100000,OC-9,F-9",
    );
  });
});
