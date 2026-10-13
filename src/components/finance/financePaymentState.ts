import { isOverdue } from "../../lib/finance";
import type { FinanceRow, SavedPayment } from "../../services/financeService";
import type { BadgeTone } from "../shared/statusBadgeTones";

/** The canon's "10 por página" select. */
export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

/** R-03a: the canon's "Reserva 25%" chip — whether the reserve came in. */
export function reserveChip(row: { reservePaid: boolean }): {
  tone: BadgeTone;
  label: string;
} {
  return row.reservePaid
    ? { tone: "ok", label: "Pagado" }
    : { tone: "crit", label: "No pagado" };
}

export interface FinanceLists {
  pendingRows: FinanceRow[];
  paidRows: FinanceRow[];
}

/**
 * R-03a: folds what `PATCH /api/payments/[id]` saved back into the board, so the row moves
 * between Pendientes and Pagados without a reload. Amounts are re-derived from the row's own
 * `reserve` (already resolved per order by `FinanceService.getBoard`), never from a default share.
 */
export function applySavedPayment(
  lists: FinanceLists,
  saved: SavedPayment,
  now: Date,
): FinanceLists {
  const current =
    lists.pendingRows.find((r) => r.id === saved.id) ??
    lists.paidRows.find((r) => r.id === saved.id);
  if (!current) return lists;

  const updated: FinanceRow = {
    ...current,
    fullyPaid: saved.fullyPaid,
    reservePaid: saved.reservePaid,
    purchaseOrder: saved.purchaseOrder,
    invoiceNumber: saved.invoiceNumber,
  };

  if (saved.fullyPaid) {
    updated.outstanding = 0;
    updated.collected = current.total;
    updated.overdue = false;
    updated.paidAt = saved.paidAt;
    updated.paidAtSource = saved.paidAt ? "date_paid" : null;
  } else {
    updated.outstanding = saved.reservePaid
      ? Math.max(0, current.total - current.reserve)
      : current.total;
    updated.collected = saved.reservePaid ? current.reserve : 0;
    updated.paidAt = null;
    updated.paidAtSource = null;
    updated.overdue = isOverdue(
      {
        status: current.status,
        total: current.total,
        reservePaid: saved.reservePaid,
        fullyPaid: false,
        endDate: current.endDate,
      },
      now,
    );
  }

  const wasPaid = current.fullyPaid;
  if (wasPaid === saved.fullyPaid) {
    const replace = (rows: FinanceRow[]) =>
      rows.map((r) => (r.id === saved.id ? updated : r));
    return {
      pendingRows: replace(lists.pendingRows),
      paidRows: replace(lists.paidRows),
    };
  }

  const without = (rows: FinanceRow[]) => rows.filter((r) => r.id !== saved.id);
  return saved.fullyPaid
    ? {
        pendingRows: without(lists.pendingRows),
        paidRows: [updated, ...lists.paidRows],
      }
    : {
        pendingRows: [updated, ...lists.pendingRows],
        paidRows: without(lists.paidRows),
      };
}
