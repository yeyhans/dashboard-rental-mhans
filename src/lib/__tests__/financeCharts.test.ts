import { describe, expect, it } from "vitest";
import {
  buildFinanceCharts,
  collectionRate,
  daysSalesOutstanding,
  dueSoon,
  incomeComposition,
  invoiceStatus,
  monthlyFinance,
  reserveStatus,
  topClients,
  trailingMonths,
  type ChartOrder,
} from "../financeCharts";

/**
 * R-03b: the Finanzas tab of Finanzas & Cobranza (canon RC2.1.4). Only metrics the data can
 * back: no "Salud Financiera" index and no year-over-year.
 */
const now = new Date("2026-10-13T15:00:00.000Z");

function order(overrides: Partial<ChartOrder> = {}): ChartOrder {
  return {
    status: "completed",
    total: 100000,
    reservePaid: false,
    fullyPaid: false,
    reserveType: null,
    reserveValue: null,
    createdAt: "2026-10-05T12:00:00Z",
    client: "Ana Pérez",
    clientType: "natural",
    invoiceNumber: null,
    ...overrides,
  };
}

describe("trailingMonths", () => {
  it("lists the last N business months ending with the current one", () => {
    expect(trailingMonths(now, 3)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(trailingMonths(new Date("2026-02-10T12:00:00Z"), 3)).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
});

describe("monthlyFinance", () => {
  it("buckets invoiced, collected and owed money by the month the order was created", () => {
    const points = monthlyFinance(
      [
        order({ fullyPaid: true }),
        order({ reservePaid: true }),
        order({ createdAt: "2026-09-20T12:00:00Z" }),
        order({ status: "cancelled" }),
        // Out of the window: dropped.
        order({ createdAt: "2025-01-01T12:00:00Z" }),
      ],
      now,
      2,
    );

    expect(points).toEqual([
      {
        month: "2026-09",
        ingresos: 100000,
        cobrado: 0,
        pendiente: 100000,
        brecha: 100000,
        pedidos: 1,
      },
      {
        month: "2026-10",
        ingresos: 200000,
        cobrado: 125000,
        pendiente: 75000,
        brecha: 75000,
        pedidos: 2,
      },
    ]);
  });

  it("reads the month in Chile, not UTC", () => {
    // 2026-10-01T02:00Z is still 30 September in Santiago.
    const [sep, oct] = monthlyFinance(
      [order({ createdAt: "2026-10-01T02:00:00Z" })],
      now,
      2,
    );
    expect(sep!.pedidos).toBe(1);
    expect(oct!.pedidos).toBe(0);
  });
});

describe("incomeComposition", () => {
  it("splits income by client type and drops empty slices", () => {
    expect(
      incomeComposition([
        order({ clientType: "empresa", total: 300000 }),
        order({ clientType: "natural", total: 100000 }),
        order({ status: "cancelled", clientType: "natural", total: 999999 }),
      ]),
    ).toEqual([
      { key: "empresa", label: "Empresa", value: 300000, share: 75 },
      { key: "natural", label: "Persona natural", value: 100000, share: 25 },
    ]);
  });

  it("keeps orders without a client type visible", () => {
    expect(incomeComposition([order({ clientType: null })])).toEqual([
      { key: "sin-tipo", label: "Sin tipo", value: 100000, share: 100 },
    ]);
  });
});

describe("collectionRate", () => {
  it("is collected over invoiced, as a whole percentage", () => {
    expect(
      collectionRate([
        order({ fullyPaid: true }),
        order({ reservePaid: true }),
      ]),
    ).toBe(63);
  });

  it("is null without invoiced money", () => {
    expect(collectionRate([])).toBeNull();
    expect(collectionRate([order({ status: "cancelled" })])).toBeNull();
  });
});

describe("daysSalesOutstanding", () => {
  it("is what is still owed over what was invoiced, times the days of the window", () => {
    // Owed 175.000 of 200.000 invoiced over 360 days: 315 days.
    expect(
      daysSalesOutstanding(
        [order({ reservePaid: true }), order({ fullyPaid: false })],
        360,
      ),
    ).toBe(315);
  });

  it("is null without invoiced money", () => {
    expect(daysSalesOutstanding([], 360)).toBeNull();
  });
});

describe("reserveStatus and invoiceStatus", () => {
  const orders = [
    order({ reservePaid: true, invoiceNumber: "F-1" }),
    order({ fullyPaid: true, invoiceNumber: "  " }),
    order({}),
    order({ status: "cancelled", reservePaid: true, invoiceNumber: "F-9" }),
  ];

  it("counts reserves in vs still out, a full payment counting as in", () => {
    expect(reserveStatus(orders)).toEqual({ cobradas: 2, pendientes: 1 });
  });

  it("counts invoices issued vs not, ignoring blank numbers", () => {
    expect(invoiceStatus(orders)).toEqual({ emitidas: 1, pendientes: 2 });
  });
});

describe("topClients", () => {
  it("ranks clients by invoiced money, with their collection rate", () => {
    expect(
      topClients(
        [
          order({
            client: "Estudio Sur",
            clientType: "empresa",
            total: 400000,
            fullyPaid: true,
          }),
          order({
            client: "Estudio Sur",
            clientType: "empresa",
            total: 100000,
          }),
          order({ client: "Ana Pérez", total: 200000, reservePaid: true }),
          order({ client: "Luis Rojas", total: 50000 }),
        ],
        2,
      ),
    ).toEqual([
      {
        client: "Estudio Sur",
        clientType: "empresa",
        total: 500000,
        orders: 2,
        cobranza: 80,
      },
      {
        client: "Ana Pérez",
        clientType: "natural",
        total: 200000,
        orders: 1,
        cobranza: 25,
      },
    ]);
  });
});

describe("dueSoon", () => {
  const row = (id: number, endDate: string | null, outstanding = 75000) => ({
    id,
    reference: `#${id}`,
    client: "Ana",
    endDate,
    outstanding,
  });

  it("lists balances falling due in the next 7 days, soonest first", () => {
    const result = dueSoon(
      [
        row(1, "2026-10-20"),
        row(2, "2026-10-13"),
        row(3, "2026-10-21"),
        row(4, "2026-10-12"),
        row(5, null),
        row(6, "2026-10-15", 0),
      ],
      now,
    );
    expect(result.map((r) => [r.id, r.daysLeft])).toEqual([
      [2, 0],
      [1, 7],
    ]);
  });
});

describe("buildFinanceCharts", () => {
  it("bundles the series and indicators over the 12-month window only", () => {
    const charts = buildFinanceCharts(
      [
        order({ fullyPaid: true }),
        order({ createdAt: "2024-01-01T00:00:00Z" }),
      ],
      now,
    );
    expect(charts.months).toHaveLength(12);
    expect(charts.months.at(-1)).toMatchObject({
      month: "2026-10",
      ingresos: 100000,
    });
    expect(charts.collectionRate).toBe(100);
    expect(charts.reserves).toEqual({ cobradas: 1, pendientes: 0 });
    expect(charts.topClients).toHaveLength(1);
    expect(charts.windowStart).toBe("2025-11");
  });
});
