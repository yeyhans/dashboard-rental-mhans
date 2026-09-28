import type { BadgeTone } from "../shared/statusBadgeTones";

export interface FinancePaymentLike {
  overdue: boolean;
  reservePaid: boolean;
}

/**
 * Tone + label for the D-10 canon "Pago" column, extracted from the inline span the Pendientes
 * table used to build so it is covered by a plain unit test instead of only a render check.
 * Same three states, same precedence: overdue always wins over the reserve state.
 */
export function financePaymentTone(row: FinancePaymentLike): {
  tone: BadgeTone;
  label: string;
} {
  if (row.overdue) return { tone: "crit", label: "Vencido" };
  if (row.reservePaid) return { tone: "ok", label: "Reserva pagada" };
  return { tone: "warn", label: "Sin reserva" };
}
