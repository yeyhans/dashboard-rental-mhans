import { describe, expect, it } from "vitest";
import {
  recomputePaidKpis,
  recomputePendingKpis,
  recomputeSummary,
} from "../financePeriodKpis";
import type { FinanceRow } from "../../../services/financeService";

function row(overrides: Partial<FinanceRow> = {}): FinanceRow {
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

describe("recomputePendingKpis", () => {
  it("sums outstanding/reserve directly from the rows' own precomputed fields", () => {
    const rows = [
      row({
        id: 1,
        outstanding: 75000,
        reserve: 25000,
        reservePaid: true,
        overdue: false,
      }),
      row({
        id: 2,
        outstanding: 100000,
        reserve: 0,
        reservePaid: false,
        overdue: true,
      }),
    ];
    expect(recomputePendingKpis(rows)).toEqual({
      montoPendiente: 175000,
      documentosPendientes: 2,
      pedidosPendientes: 2,
      reservasPendientes: 1,
      montoReservasPendientes: 0,
      montoVencido: 100000,
      documentosVencidos: 1,
    });
  });

  it("returns all-zero KPIs for an empty row set", () => {
    expect(recomputePendingKpis([])).toEqual({
      montoPendiente: 0,
      documentosPendientes: 0,
      pedidosPendientes: 0,
      reservasPendientes: 0,
      montoReservasPendientes: 0,
      montoVencido: 0,
      documentosVencidos: 0,
    });
  });
});

describe("recomputePaidKpis", () => {
  it("sums total and averages the ticket", () => {
    const rows = [row({ total: 100000 }), row({ total: 300000 })];
    expect(recomputePaidKpis(rows)).toEqual({
      cobradoPeriodo: 400000,
      pedidosPagados: 2,
      ticketPromedio: 200000,
    });
  });

  it("returns 0 ticket promedio, not NaN, for an empty row set", () => {
    expect(recomputePaidKpis([])).toEqual({
      cobradoPeriodo: 0,
      pedidosPagados: 0,
      ticketPromedio: 0,
    });
  });
});

describe("recomputeSummary", () => {
  it("combines pending and paid rows into ingresos/cobros/porCobrar/tasaCobranza", () => {
    const pending = [row({ total: 100000, collected: 25000 })];
    const paid = [row({ total: 200000, collected: 200000 })];
    expect(recomputeSummary(pending, paid)).toEqual({
      ingresosPeriodo: 300000,
      cobrosRecibidos: 225000,
      porCobrar: 75000,
      tasaCobranza: 75,
    });
  });

  it("returns a 0 tasaCobranza, not NaN, when there is no revenue", () => {
    expect(recomputeSummary([], [])).toEqual({
      ingresosPeriodo: 0,
      cobrosRecibidos: 0,
      porCobrar: 0,
      tasaCobranza: 0,
    });
  });
});
