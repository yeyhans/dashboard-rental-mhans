/** D-24 07c: the "estado de pago" filter inside the Finanzas "Filtros" panel. */
export type PaymentFilterKey =
  | "all"
  | "overdue"
  | "reserve-paid"
  | "no-reserve";

export const PAYMENT_FILTER_OPTIONS: ReadonlyArray<{
  value: PaymentFilterKey;
  label: string;
}> = [
  { value: "all", label: "Todos" },
  { value: "overdue", label: "Vencido" },
  { value: "reserve-paid", label: "Reserva pagada" },
  { value: "no-reserve", label: "Sin reserva" },
];

export interface FinancePaymentFilterLike {
  readonly overdue: boolean;
  readonly reservePaid: boolean;
}

/** Mirrors the three states `financePaymentTone` renders, so the filter matches the Pago column exactly. */
export function matchesPaymentFilter(
  row: FinancePaymentFilterLike,
  filter: PaymentFilterKey,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "overdue":
      return row.overdue;
    case "reserve-paid":
      return !row.overdue && row.reservePaid;
    case "no-reserve":
      return !row.overdue && !row.reservePaid;
  }
}
