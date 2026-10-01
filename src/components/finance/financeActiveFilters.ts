import {
  PAYMENT_FILTER_OPTIONS,
  type PaymentFilterKey,
} from "./financePaymentFilter";

/**
 * D-27 follow-up (R3-finance-search-hidden-when-collapsed / R3-finance-summary-hidden-filters):
 * when the "Filtros" panel is collapsed, the client search and the "Estado de pago" filter keep
 * hiding rows from the table AND from the KPI/summary totals, with no visible trace of why.
 * These two pure helpers compute what to show so collapsing the panel never hides the fact that
 * a filter is still active.
 */
export interface ActiveFinanceFilterChip {
  readonly key: "search" | "payment";
  readonly label: string;
}

/**
 * One compact chip per active filter — `Cliente: <texto>` and/or `Estado: <etiqueta>` — regardless
 * of whether the "Filtros" panel is open or collapsed. The caller decides when to render the row
 * (only while collapsed, since the panel itself already shows the same inputs when open).
 */
export function financeActiveFilterChips(params: {
  search: string;
  paymentFilter: PaymentFilterKey;
  /** The "Estado de pago" filter only exists on the Pendientes tab. */
  showPaymentFilter: boolean;
}): ActiveFinanceFilterChip[] {
  const chips: ActiveFinanceFilterChip[] = [];
  const trimmedSearch = params.search.trim();

  if (trimmedSearch) {
    chips.push({ key: "search", label: `Cliente: ${trimmedSearch}` });
  }

  if (params.showPaymentFilter && params.paymentFilter !== "all") {
    const option = PAYMENT_FILTER_OPTIONS.find(
      (o) => o.value === params.paymentFilter,
    );
    chips.push({
      key: "payment",
      label: `Estado: ${option?.label ?? params.paymentFilter}`,
    });
  }

  return chips;
}

/**
 * The label the KPI/summary row and the Exportar area show: the active period, plus every active
 * filter chip, so the numbers' scope is explicit instead of implied by whatever happens to be
 * selected in a collapsed panel.
 */
export function financeSummaryFilterLabel(params: {
  periodLabel: string;
  chips: readonly ActiveFinanceFilterChip[];
}): string {
  if (params.chips.length === 0) return params.periodLabel;
  return `${params.periodLabel} · ${params.chips.map((c) => c.label).join(" · ")}`;
}
