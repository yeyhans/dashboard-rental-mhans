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
    paidAt: null as string | null,
    paidAtSource: null as "date_paid" | "date_completed" | null,
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

describe("FinanceBoard — pagination (07.1) and period control (07.4)", () => {
  const manyRows = Array.from({ length: 25 }, (_, i) =>
    row({ id: i + 1, reference: `#R${String(i + 1).padStart(3, "0")}` }),
  );

  it("shows only 10 pending rows with the 'Mostrando 1 a 10 de N resultados' label", () => {
    const html = renderToStaticMarkup(
      <FinanceBoard
        data={makeData({ pendingRows: manyRows })}
        periodLabel="septiembre 2026"
      />,
    );
    expect(html).toContain("Mostrando 1 a 10 de 25 resultados");
    expect(html).toContain("#R010");
    expect(html).not.toContain("#R011");
  });

  it("renders prev/next controls, with prev disabled on the first page", () => {
    const html = renderToStaticMarkup(
      <FinanceBoard
        data={makeData({ pendingRows: manyRows })}
        periodLabel="septiembre 2026"
      />,
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Anterior</);
    expect(html).toMatch(/<button(?![^>]*disabled="")[^>]*>Siguiente</);
  });

  it("omits the pager controls when everything fits in one page", () => {
    const html = renderToStaticMarkup(
      <FinanceBoard
        data={makeData({ pendingRows: manyRows.slice(0, 3) })}
        periodLabel="septiembre 2026"
      />,
    );
    expect(html).toContain("Mostrando 1 a 3 de 3 resultados");
    expect(html).not.toContain(">Siguiente<");
  });

  it("styles the period selector as a date-range control with a calendar icon", () => {
    const html = renderToStaticMarkup(
      <FinanceBoard data={makeData()} periodLabel="septiembre 2026" />,
    );
    expect(html).toMatch(
      /lucide-calendar[^>]*>.*<select[^>]*aria-label="Período"/s,
    );
  });
});

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

describe("FinanceBoard — R-03a Pendientes columns to canon", () => {
  const html = renderToStaticMarkup(
    <FinanceBoard
      data={makeData({
        pendingRows: [
          row({ id: 1, reservePaid: true, purchaseOrder: "OC-12" }),
          row({ id: 2, reference: "#0002", reservePaid: false }),
        ],
      })}
      periodLabel="octubre 2026"
    />,
  );

  it("shows the reserve as a Pagado / No pagado chip next to its amount", () => {
    expect(html).toContain(">Reserva<");
    expect(html).toMatch(/25\.000[\s\S]*Pagado/);
    expect(html).toContain("No pagado");
  });

  it("offers a Pago select per row, sitting on No pagado", () => {
    expect(html).toContain('aria-label="Estado de pago pedido #0001"');
    expect(html).toMatch(
      /<option value="no-pagado" selected="">No pagado<\/option>/,
    );
    expect(html).toContain('<option value="pagado">Pagado</option>');
  });

  it("lets OC and Factura be typed in place", () => {
    expect(html).toContain('aria-label="Orden de compra pedido #0001"');
    expect(html).toContain('value="OC-12"');
    expect(html).toContain('aria-label="Número de factura pedido #0002"');
  });

  it("adds the Acciones column with a row menu", () => {
    expect(html).toContain(">Acciones<");
    expect(html).toContain('aria-label="Acciones del pedido #0001"');
  });

  it("offers 10 / 20 / 50 rows per page", () => {
    expect(html).toContain('aria-label="Filas por página"');
    expect(html).toMatch(/<option value="10" selected="">10<\/option>/);
    expect(html).toContain('<option value="20">20</option>');
    expect(html).toContain('<option value="50">50</option>');
  });
});

describe("FinanceBoard — R-03a Pagados to canon", () => {
  it("adds the Acción column, flags an approximate payment date and compares with last month", () => {
    const now = new Date("2026-10-13T15:00:00.000Z");
    const paid = (overrides: Parameters<typeof row>[0]) =>
      row({ fullyPaid: true, outstanding: 0, collected: 100000, ...overrides });
    // `initialTab` opens Pagados so the static render shows it.
    const html = renderToStaticMarkup(
      <FinanceBoard
        data={makeData({
          paidRows: [
            paid({
              id: 1,
              paidAt: "2026-10-02T12:00:00Z",
              paidAtSource: "date_paid",
            }),
            paid({
              id: 2,
              reference: "#0002",
              paidAt: "2026-09-20T12:00:00Z",
              paidAtSource: "date_completed",
            }),
          ],
        })}
        periodLabel="octubre 2026"
        now={now}
        initialTab="pagados"
      />,
    );

    expect(html).toContain(">Acción<");
    expect(html).toContain('aria-label="Acciones del pedido #0002"');
    expect(html).toContain("Fecha de cierre del pedido");
    expect(html).toContain("0% vs mes anterior");
  });
});
