import { describe, expect, it } from "vitest";
import {
  financeRowsToCsv,
  buildFinanceExportBlob,
  buildFinanceExportFilename,
} from "../financeExport";
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

  it("doubles an embedded double-quote inside a quoted field", () => {
    const csv = financeRowsToCsv(
      [makeRow({ project: 'Sesión "producto"' })],
      "pendientes",
    );
    const [, line] = csv.split("\n");
    expect(line).toContain('"Sesión ""producto"""');
  });

  it("quotes a field containing an embedded newline", () => {
    const csv = financeRowsToCsv(
      [makeRow({ client: "Ana\nPérez" })],
      "pendientes",
    );
    expect(csv).toContain('"Ana\nPérez"');
  });

  it("quotes a field containing a bare carriage return (D-16)", () => {
    const csv = financeRowsToCsv(
      [makeRow({ client: "Ana\rPérez" })],
      "pendientes",
    );
    expect(csv).toContain('"Ana\rPérez"');
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

/**
 * D-18: `FinanceBoard.handleExport` built the BOM-prefixed blob content and the filename inline,
 * so neither was covered by a test — pull them out as pure functions.
 */
describe("buildFinanceExportBlobContent (BOM, D-16)", () => {
  it("prefixes the CSV with a UTF-8 BOM so Excel reads accents correctly", () => {
    const content = buildFinanceExportBlob("a,b\n1,2");
    expect(content.charCodeAt(0)).toBe(0xfeff);
    expect(content.slice(1)).toBe("a,b\n1,2");
  });

  it("does not double the BOM when called again", () => {
    const content = buildFinanceExportBlob("");
    expect(content).toBe("﻿");
  });
});

describe("buildFinanceExportFilename", () => {
  it("names the file with the tab and the Chilean business day, not the server's UTC one", () => {
    // 02:00 UTC on 2026-09-11 is still 22:00 on 2026-09-10 in America/Santiago (D-16, R3-104) —
    // the server's UTC day would wrongly name the file one day ahead.
    const lateNightUtc = new Date("2026-09-11T02:00:00.000Z");
    expect(buildFinanceExportFilename("pendientes", lateNightUtc)).toBe(
      "finanzas-pendientes-2026-09-10.csv",
    );
  });

  it("uses the pagados tab name", () => {
    const instant = new Date("2026-01-15T18:00:00.000Z");
    expect(buildFinanceExportFilename("pagados", instant)).toBe(
      "finanzas-pagados-2026-01-15.csv",
    );
  });
});
