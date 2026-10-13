import { describe, expect, it } from "vitest";
import type { FinanceRow } from "../../../services/financeService";
import {
  applySavedPayment,
  PAGE_SIZE_OPTIONS,
  reserveChip,
} from "../financePaymentState";

function row(overrides: Partial<FinanceRow> = {}): FinanceRow {
  return {
    id: 1,
    reference: "#0001",
    client: "Ana Pérez",
    project: "Sesión producto",
    status: "completed",
    total: 100000,
    reserve: 25000,
    outstanding: 75000,
    collected: 25000,
    reservePaid: true,
    fullyPaid: false,
    overdue: true,
    endDate: "2026-09-10",
    paidAt: null,
    paidAtSource: null,
    purchaseOrder: null,
    invoiceNumber: null,
    ...overrides,
  };
}

const now = new Date("2026-10-13T15:00:00.000Z");

describe("reserveChip", () => {
  it("reads Pagado / No pagado off the reserve flag", () => {
    expect(reserveChip({ reservePaid: true })).toEqual({
      tone: "ok",
      label: "Pagado",
    });
    expect(reserveChip({ reservePaid: false })).toEqual({
      tone: "crit",
      label: "No pagado",
    });
  });
});

describe("PAGE_SIZE_OPTIONS", () => {
  it("offers the canon's 10 / 20 / 50", () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 20, 50]);
  });
});

describe("applySavedPayment", () => {
  it("moves a row marked Pagado to the top of Pagados, settled", () => {
    const other = row({ id: 2 });
    const result = applySavedPayment(
      {
        pendingRows: [row(), other],
        paidRows: [row({ id: 9, fullyPaid: true })],
      },
      {
        id: 1,
        fullyPaid: true,
        reservePaid: true,
        paidAt: "2026-10-13T15:00:00.000Z",
        purchaseOrder: null,
        invoiceNumber: null,
      },
      now,
    );

    expect(result.pendingRows.map((r) => r.id)).toEqual([2]);
    expect(result.paidRows.map((r) => r.id)).toEqual([1, 9]);
    expect(result.paidRows[0]).toMatchObject({
      fullyPaid: true,
      reservePaid: true,
      outstanding: 0,
      collected: 100000,
      overdue: false,
      paidAt: "2026-10-13T15:00:00.000Z",
      paidAtSource: "date_paid",
    });
  });

  it("sends a reverted row back to Pendientes with its balance and overdue state", () => {
    const result = applySavedPayment(
      {
        pendingRows: [],
        paidRows: [
          row({
            fullyPaid: true,
            outstanding: 0,
            collected: 100000,
            overdue: false,
            paidAt: "2026-10-01T00:00:00Z",
            paidAtSource: "date_paid",
          }),
        ],
      },
      {
        id: 1,
        fullyPaid: false,
        reservePaid: true,
        paidAt: null,
        purchaseOrder: null,
        invoiceNumber: null,
      },
      now,
    );

    expect(result.paidRows).toEqual([]);
    expect(result.pendingRows[0]).toMatchObject({
      fullyPaid: false,
      outstanding: 75000,
      collected: 25000,
      overdue: true,
      paidAt: null,
      paidAtSource: null,
    });
  });

  it("counts the whole total as owed when the reserve was not paid either", () => {
    const result = applySavedPayment(
      {
        pendingRows: [],
        paidRows: [row({ fullyPaid: true, reservePaid: true })],
      },
      {
        id: 1,
        fullyPaid: false,
        reservePaid: false,
        paidAt: null,
        purchaseOrder: null,
        invoiceNumber: null,
      },
      now,
    );
    expect(result.pendingRows[0]).toMatchObject({
      outstanding: 100000,
      collected: 0,
    });
  });

  it("updates the documents in place without moving the row", () => {
    const result = applySavedPayment(
      { pendingRows: [row({ id: 3 }), row()], paidRows: [] },
      {
        id: 1,
        fullyPaid: false,
        reservePaid: true,
        paidAt: null,
        purchaseOrder: "OC-5",
        invoiceNumber: "F-77",
      },
      now,
    );
    expect(result.pendingRows.map((r) => r.id)).toEqual([3, 1]);
    expect(result.pendingRows[1]).toMatchObject({
      purchaseOrder: "OC-5",
      invoiceNumber: "F-77",
    });
  });

  it("leaves both lists untouched for an unknown id", () => {
    const lists = { pendingRows: [row()], paidRows: [] };
    expect(
      applySavedPayment(
        lists,
        {
          id: 404,
          fullyPaid: true,
          reservePaid: true,
          paidAt: null,
          purchaseOrder: null,
          invoiceNumber: null,
        },
        now,
      ),
    ).toEqual(lists);
  });
});
