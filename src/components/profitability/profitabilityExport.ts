import { rowsToCsv, buildCsvBlob } from "../../lib/csv";
import { businessDay } from "../../lib/businessDay";
import type { MonthlyMargin, MonthlyRevenue } from "../../lib/profitability";

const MARGIN_HEADER = [
  "Mes",
  "Ingresos",
  "Costos Directos",
  "Gastos Operacionales",
  "Utilidad Operacional",
  "Margen Bruto %",
  "Margen Operacional %",
];

function roundPercentage(value: number | null): string {
  return value === null ? "" : String(Math.round(value * 10) / 10);
}

function marginLine(point: MonthlyMargin): string[] {
  return [
    point.month,
    String(point.ingresos),
    String(point.costosDirectos),
    String(point.gastosOperacionales),
    String(point.utilidadOperacional),
    roundPercentage(point.margenBrutoPercentage),
    roundPercentage(point.margenOperacionalPercentage),
  ];
}

/** D-24 08d: the "Evolución resultados" + "Márgenes (%)" series, CSV of the visible points. */
export function marginSeriesToCsv(series: readonly MonthlyMargin[]): string {
  return rowsToCsv(MARGIN_HEADER, series.map(marginLine));
}

/**
 * Fallback export while `marginSeries` is `null` (migración de `expenses` sin aplicar): just the
 * Ingresos series the chart falls back to, not invented cost figures.
 */
export function revenueSeriesToCsv(series: readonly MonthlyRevenue[]): string {
  return rowsToCsv(
    ["Mes", "Ingresos"],
    series.map((point) => [point.month, String(point.ingresos)]),
  );
}

/** Same BOM-prefixed blob rule as Finanzas's "Exportar" (`buildFinanceExportBlob`). */
export function buildProfitabilityExportBlob(csv: string): string {
  return buildCsvBlob(csv);
}

/** Same Chilean-business-day filename rule as Finanzas's "Exportar" (`buildFinanceExportFilename`). */
export function buildProfitabilityExportFilename(now: Date): string {
  return `rentabilidad-${businessDay(now)}.csv`;
}
