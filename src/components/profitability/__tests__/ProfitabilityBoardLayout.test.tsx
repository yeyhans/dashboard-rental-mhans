import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Same mock as `ProfitabilityBoard.test.tsx`: `ExpensesPanel` imports `apiClient`.
vi.mock("../../../services/apiClient", () => ({
  apiClient: {
    get: vi.fn(() => new Promise(() => {})),
    post: vi.fn(),
    delete: vi.fn(),
    handleJsonResponse: vi.fn(),
  },
}));

import ProfitabilityBoard from "../ProfitabilityBoard";
import type { ProfitabilityBoard as ProfitabilityBoardData } from "../../../services/profitabilityService";

/**
 * D-10 (revisiones cliente oct, 08.1-08.5): uppercase H1 via PageHeader, underlined tabs,
 * Período/Exportar in the page header, one row of 5 KPIs on `lg`, wider chart Y axis.
 */
const boardSource = readFileSync(
  path.resolve(__dirname, "../ProfitabilityBoard.tsx"),
  "utf8",
);
const pageSource = readFileSync(
  path.resolve(__dirname, "../../../pages/profitability.astro"),
  "utf8",
);

function makeData(
  overrides: Partial<ProfitabilityBoardData> = {},
): ProfitabilityBoardData {
  const emptyMetrics = {
    ingresos: 0,
    jornadasVendidas: 0,
    pedidosRealizados: 0,
    ticketPromedio: 0,
    equiposUtilizados: 0,
  };
  return {
    current: { ...emptyMetrics, ingresos: 1200000 },
    previous: emptyMetrics,
    deltas: {
      ingresos: null,
      jornadasVendidas: null,
      ticketPromedio: null,
      pedidosRealizados: null,
      equiposUtilizados: null,
    },
    series: [],
    marginSeries: null,
    rotation: [],
    idle: [],
    diasPeriodo: 30,
    costs: null,
    ...overrides,
  };
}

const withCosts = makeData({
  costs: {
    costosDirectos: 400000,
    margenBruto: { margin: 800000, marginPercentage: 66.7 },
    gastosOperacionales: 200000,
    utilidadOperacional: { margin: 600000, marginPercentage: 50 },
    roiPromedioActivos: null,
  },
});

function render(data = makeData()) {
  return renderToStaticMarkup(
    <ProfitabilityBoard data={data} periodLabel="septiembre 2026" />,
  );
}

describe("Rentabilidad page header (08.1, 08.3)", () => {
  it("renders the shared PageHeader: uppercase H1 with Período and Exportar in the header", () => {
    const html = render();
    const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
    expect(header).toMatch(/<h1[^>]*uppercase[^>]*>Rentabilidad<\/h1>/);
    expect(header).toContain("Período del gráfico");
    expect(header).toContain("Exportar");
  });

  it("no longer renders Período/Exportar inside the chart card", () => {
    const html = render();
    const chart = html.slice(html.indexOf("Evolución resultados"));
    expect(chart).not.toContain("Período del gráfico");
  });

  it("the page no longer hand-rolls a sentence-case H1 (error state uses PageHeader too)", () => {
    expect(pageSource).not.toMatch(/<h1/);
    expect(pageSource).toContain("PageHeader");
  });
});

describe("Rentabilidad tabs (08.2)", () => {
  it("uses underlined tabs instead of bordered buttons", () => {
    const tablist =
      render().match(/<div[^>]*role="tablist"[\s\S]*?<\/div>/)?.[0] ?? "";
    expect(tablist).not.toMatch(/border border-border/);
    expect(tablist).toMatch(/border-b-2/);
  });
});

describe("Rentabilidad KPI row (08.4)", () => {
  it("lays the five canon KPIs out as one row of 5 on lg", () => {
    // Only the Resumen block: other tabs render their own grids further down.
    const full = render(withCosts);
    const html = full.slice(0, full.indexOf("Evolución resultados"));
    expect(html).toContain("lg:grid-cols-5");
    expect(html).not.toContain("lg:grid-cols-4");
    for (const label of [
      "Ingresos del Período",
      "Costos Directos",
      "Margen Bruto",
      "Gastos Operacionales",
      "Utilidad Operacional",
    ]) {
      expect(html).toContain(label);
    }
  });

  it("keeps the ROI explanatory empty state, with no invented figure", () => {
    const html = render(withCosts);
    expect(html).toContain("ROI promedio activos");
    expect(html).toContain("no hay base para calcular el ROI");
  });

  it("keeps the unavailable-costs explanation when the expenses migration is missing", () => {
    const html = render(makeData());
    expect(html).toContain("Costos, márgenes y utilidad");
  });
});

describe("Rentabilidad chart Y axis (08.5)", () => {
  it("widens the revenue Y axis so CLP amounts are not clipped", () => {
    expect(boardSource).not.toMatch(/<YAxis[^>]*width=\{56\}/);
    expect(boardSource).toMatch(/<YAxis[^>]*width=\{(7\d|8\d|9\d)\}/);
  });
});
