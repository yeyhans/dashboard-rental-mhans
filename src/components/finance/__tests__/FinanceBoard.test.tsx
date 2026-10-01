import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FinanceBoard from "../FinanceBoard";
import type { FinanceBoard as FinanceBoardData } from "../../../services/financeService";
import { monthlyBucketSums, sparklinePoints } from "../../../lib/sparkline";

function row(overrides: Partial<FinanceBoardData["pendingRows"][number]> = {}) {
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
    endDate: "2026-07-10",
    paidAt: null,
    purchaseOrder: null,
    invoiceNumber: null,
    ...overrides,
  };
}

function makeData(overrides: Partial<FinanceBoardData> = {}): FinanceBoardData {
  return {
    pending: {
      montoPendiente: 0,
      documentosPendientes: 0,
      pedidosPendientes: 0,
      reservasPendientes: 0,
      montoReservasPendientes: 0,
      montoVencido: 0,
      documentosVencidos: 0,
    },
    paid: { cobradoPeriodo: 0, pedidosPagados: 0, ticketPromedio: 0 },
    summary: {
      ingresosPeriodo: 0,
      cobrosRecibidos: 0,
      porCobrar: 0,
      tasaCobranza: 0,
    },
    pendingRows: [],
    paidRows: [],
    ...overrides,
  };
}

describe("FinanceBoard — period selector + Filtros (D-24 07c)", () => {
  it("renders the period selector with the canon labels", () => {
    const html = renderToStaticMarkup(
      <FinanceBoard data={makeData()} periodLabel="septiembre 2026" />,
    );
    expect(html).toContain("Este mes");
    expect(html).toContain("Mes anterior");
    expect(html).toContain("Últimos 90 días");
    expect(html).toContain("Todo");
  });

  it('shows a "Filtros" button and keeps the panel closed by default', () => {
    const html = renderToStaticMarkup(
      <FinanceBoard data={makeData()} periodLabel="septiembre 2026" />,
    );
    expect(html).toContain("Filtros");
    expect(html).not.toContain("Estado de pago");
  });

  it("recomputes the KPIs from the rows' own precomputed totals, not a stale server snapshot", () => {
    const data = makeData({
      // The server-computed `pending` KPI intentionally does not match the rows below, so the
      // test fails if the board just renders `data.pending` instead of recomputing it.
      pending: {
        montoPendiente: 999999,
        documentosPendientes: 99,
        pedidosPendientes: 99,
        reservasPendientes: 99,
        montoReservasPendientes: 999999,
        montoVencido: 999999,
        documentosVencidos: 99,
      },
      pendingRows: [
        row({ id: 1, outstanding: 75000 }),
        row({ id: 2, outstanding: 25000 }),
      ],
    });
    const html = renderToStaticMarkup(
      <FinanceBoard data={data} periodLabel="septiembre 2026" />,
    );
    expect(html).toContain("100.000"); // 75000 + 25000, recomputed
    expect(html).not.toContain("999.999");
  });

  it("renders a sparkline polyline for Monto Pendiente with the real trailing-6-month values (D-27 R3-sparkline-test-vacuous-time-dependent)", () => {
    // Fixed `now` (via the injectable prop) instead of the real clock: the two rows' months must
    // land inside the trailing 6-month window relative to a KNOWN date, not whatever date the
    // suite happens to run on.
    const now = new Date("2026-09-15T12:00:00.000Z");
    const data = makeData({
      pendingRows: [
        row({ id: 1, endDate: "2026-06-05", outstanding: 75000 }),
        row({ id: 2, endDate: "2026-07-10", outstanding: 25000 }),
      ],
    });
    const html = renderToStaticMarkup(
      <FinanceBoard data={data} periodLabel="septiembre 2026" now={now} />,
    );

    // The real values this component must compute: a 6-bucket (Apr..Sep) sum of `outstanding`.
    const expectedBuckets = monthlyBucketSums(
      data.pendingRows,
      (r) => r.endDate,
      (r) => r.outstanding,
      now,
      6,
    );
    expect(expectedBuckets).toEqual([0, 0, 75000, 25000, 0, 0]);
    const expectedPoints = sparklinePoints(expectedBuckets, 56, 18);

    expect(html).toContain("<polyline");
    expect(html).toContain(`points="${expectedPoints}"`);
  });
});

describe("FinanceBoard — active filter visibility while collapsed (D-27)", () => {
  it('shows no filter chips and the plain period in "Mostrando" when nothing is filtered', () => {
    const html = renderToStaticMarkup(
      <FinanceBoard data={makeData()} periodLabel="septiembre 2026" />,
    );
    expect(html).toContain("Mostrando: Todo");
    expect(html).not.toContain("Cliente:");
    expect(html).not.toContain("Estado:");
    expect(html).not.toContain("Limpiar");
  });

  it("the collapsed Filtros panel still does not leak into the chip assertions above", () => {
    // Sanity check for the test above: the panel is closed by default, so the only way these
    // strings could appear is through the new chip row / summary label themselves.
    const html = renderToStaticMarkup(
      <FinanceBoard data={makeData()} periodLabel="septiembre 2026" />,
    );
    expect(html).not.toContain("Estado de pago");
  });
});
