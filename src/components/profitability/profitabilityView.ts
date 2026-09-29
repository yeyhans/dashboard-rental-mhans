/**
 * D-11 (revisiones-cliente): the pure, testable pieces of the Rentabilidad board.
 *
 * Source: `MarioHans_OS_Area01_Rentabilidad_Canonical_RC2.1.2.html`, which asks "¿Cuánto gana el
 * negocio y qué tan bien trabajan los activos?" across four tabs. See `lib/profitability.ts`'s
 * header for the formula confirmation.
 */

export type ProfitabilityTab =
  | "resumen"
  | "gastos"
  | "activos"
  | "inteligencia";

/**
 * The 4 canon tabs, in canon order. "Activos e Inversiones" has no data source behind it (Q-5,
 * resolved): the canonical's own `<script>` never wires an `Inversion` computation (see
 * `lib/profitability.ts`), so that tab renders an explicit empty state rather than an invented
 * number.
 */
export const PROFITABILITY_TABS: ReadonlyArray<{
  value: ProfitabilityTab;
  label: string;
}> = [
  { value: "resumen", label: "Resumen Económico" },
  { value: "gastos", label: "Gastos Operacionales" },
  { value: "activos", label: "Activos e Inversiones" },
  { value: "inteligencia", label: "Inteligencia de Activos" },
];

/**
 * ROI promedio activos as a rounded percentage, or `null` when there is nothing to show.
 *
 * Replaces the old `formatROI`, which returned the literal string `'sin datos'` for the no-cost
 * case — a mono-figure placeholder the canon comparison flagged (D-11, ~L33). The caller now
 * distinguishes "no data" from a real value and renders an explicit empty state instead of a bare
 * string, so a future silent formatting change cannot turn "no data" into a real-looking number.
 */
export function roiDisplay(value: number | null): string | null {
  if (value === null) return null;
  return `${Math.round(value * 1000) / 10}%`;
}
