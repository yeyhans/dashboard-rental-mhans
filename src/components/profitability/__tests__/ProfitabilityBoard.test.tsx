import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// `ExpensesPanel` (now under the "Gastos Operacionales" tab) fetches via `apiClient` on mount;
// `renderToStaticMarkup` never runs effects, but the module import chain still needs a mock so it
// resolves cleanly, same convention as `CheckInBoard.test.tsx`.
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

describe("ProfitabilityBoard tabs (D-11)", () => {
  it("renders the 4 canon tab triggers", () => {
    const html = renderToStaticMarkup(
      <ProfitabilityBoard data={makeData()} periodLabel="septiembre 2026" />,
    );
    expect(html).toContain("Resumen Económico");
    expect(html).toContain("Gastos Operacionales");
    expect(html).toContain("Activos e Inversiones");
    expect(html).toContain("Inteligencia de Activos");
  });

  it("shows the Resumen Económico content by default", () => {
    const html = renderToStaticMarkup(
      <ProfitabilityBoard data={makeData()} periodLabel="septiembre 2026" />,
    );
    expect(html).toContain("Ingresos del Período");
  });

  it("shows an empty state for ROI instead of the 'sin datos' mono figure when there is no acquisition cost", () => {
    const html = renderToStaticMarkup(
      <ProfitabilityBoard
        data={makeData({
          costs: {
            costosDirectos: 100,
            margenBruto: { margin: 900, marginPercentage: 90 },
            gastosOperacionales: 50,
            utilidadOperacional: { margin: 850, marginPercentage: 85 },
            roiPromedioActivos: null,
          },
        })}
        periodLabel="septiembre 2026"
      />,
    );
    expect(html).not.toContain("sin datos");
    expect(html).toContain("Sin costo de adquisición registrado");
  });
});

describe("ProfitabilityBoard — Evolución resultados chart (D-24 08c/08d)", () => {
  it("replaces the flat bars with a line chart and a period selector + Exportar", () => {
    const html = renderToStaticMarkup(
      <ProfitabilityBoard data={makeData()} periodLabel="septiembre 2026" />,
    );
    expect(html).toContain("Evolución resultados (12 meses)");
    expect(html).toContain("Período del gráfico");
    expect(html).toContain("Exportar");
    // The old bar markup is gone.
    expect(html).not.toContain("Evolución de ingresos (12 meses)");
  });

  it("falls back to an Ingresos-only chart and says why when marginSeries is null", () => {
    const html = renderToStaticMarkup(
      <ProfitabilityBoard
        data={makeData({
          series: [{ month: "2026-08", ingresos: 100000, pedidos: 2 }],
          marginSeries: null,
        })}
        periodLabel="septiembre 2026"
      />,
    );
    expect(html).toContain("migración");
    expect(html).toContain("Márgenes no disponibles todavía");
  });

  it("renders the margins chart (not the empty state) when marginSeries is available", () => {
    const html = renderToStaticMarkup(
      <ProfitabilityBoard
        data={makeData({
          series: [{ month: "2026-08", ingresos: 100000, pedidos: 2 }],
          marginSeries: [
            {
              month: "2026-08",
              ingresos: 100000,
              costosDirectos: 10000,
              gastosOperacionales: 5000,
              utilidadOperacional: 85000,
              margenBrutoPercentage: 90,
              margenOperacionalPercentage: 85,
            },
          ],
        })}
        periodLabel="septiembre 2026"
      />,
    );
    expect(html).toContain("Márgenes (%)");
    expect(html).not.toContain("Márgenes no disponibles todavía");
  });
});

/**
 * Recharts' `<Legend>` needs real DOM measurement to lay out its entries, which
 * `renderToStaticMarkup` cannot provide (no `ResizeObserver`/layout) — asserting its series
 * labels there is flaky. The 4/2-series wiring itself (`dataKey`/`name`/palette-token colors) is
 * checked at the source level instead, same convention as `OrdersDashboard.sourceAssertions`.
 */
describe("ProfitabilityBoard — source assertions (D-24 08c)", () => {
  const source = readFileSync(
    path.resolve(__dirname, "../ProfitabilityBoard.tsx"),
    "utf-8",
  );

  it("plots Ingresos, Costos Directos, Gastos Operacionales and Utilidad Operacional", () => {
    expect(source).toContain('dataKey="ingresos"');
    expect(source).toContain('dataKey="costosDirectos"');
    expect(source).toContain('dataKey="gastosOperacionales"');
    expect(source).toContain('dataKey="utilidadOperacional"');
  });

  it("plots both margin percentages in the Márgenes (%) chart", () => {
    expect(source).toContain('dataKey="margenBrutoPercentage"');
    expect(source).toContain('dataKey="margenOperacionalPercentage"');
  });

  it("colors every series with a palette CSS variable, not a raw hex/Tailwind color", () => {
    const lineBlocks = source.match(/<Line\b[^>]*\/>/gs) ?? [];
    expect(lineBlocks.length).toBeGreaterThanOrEqual(6);
    for (const block of lineBlocks) {
      expect(block).toMatch(
        /stroke="var\(--color-(ok|info|warn|crit|text-primary)\)"/,
      );
    }
  });
});
