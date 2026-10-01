import { describe, expect, it } from "vitest";
import {
  buildProfitabilityExportBlob,
  buildProfitabilityExportFilename,
  marginSeriesToCsv,
  revenueSeriesToCsv,
} from "../profitabilityExport";
import type { MonthlyMargin } from "../../../lib/profitability";

function point(overrides: Partial<MonthlyMargin> = {}): MonthlyMargin {
  return {
    month: "2026-07",
    ingresos: 1000000,
    costosDirectos: 100000,
    gastosOperacionales: 200000,
    utilidadOperacional: 700000,
    margenBrutoPercentage: 90,
    margenOperacionalPercentage: 77.8,
    ...overrides,
  };
}

describe("marginSeriesToCsv", () => {
  it("returns the header and one formatted row per point", () => {
    const csv = marginSeriesToCsv([point()]);
    const [header, line] = csv.split("\n");
    expect(header).toBe(
      "Mes,Ingresos,Costos Directos,Gastos Operacionales,Utilidad Operacional,Margen Bruto %,Margen Operacional %",
    );
    expect(line).toBe("2026-07,1000000,100000,200000,700000,90,77.8");
  });

  it("renders an empty string for a null-percentage point, not a literal null", () => {
    const csv = marginSeriesToCsv([
      point({ margenBrutoPercentage: null, margenOperacionalPercentage: null }),
    ]);
    const [, line] = csv.split("\n");
    expect(line).toBe("2026-07,1000000,100000,200000,700000,,");
  });
});

describe("revenueSeriesToCsv", () => {
  it("returns the Mes/Ingresos header and one row per month", () => {
    const csv = revenueSeriesToCsv([
      { month: "2026-07", ingresos: 500000, pedidos: 3 },
    ]);
    expect(csv).toBe("Mes,Ingresos\n2026-07,500000");
  });
});

describe("buildProfitabilityExportBlob", () => {
  it("prefixes the CSV with a UTF-8 BOM", () => {
    const content = buildProfitabilityExportBlob("a,b\n1,2");
    expect(content.charCodeAt(0)).toBe(0xfeff);
  });
});

describe("buildProfitabilityExportFilename", () => {
  it("names the file with the Chilean business day, not the server's UTC one", () => {
    const lateNightUtc = new Date("2026-09-11T02:00:00.000Z");
    expect(buildProfitabilityExportFilename(lateNightUtc)).toBe(
      "rentabilidad-2026-09-10.csv",
    );
  });
});
