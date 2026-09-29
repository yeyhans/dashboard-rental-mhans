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
