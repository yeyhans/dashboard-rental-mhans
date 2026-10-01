import type { FinanceRow } from "../../services/financeService";
import type { FinanceSummary, PaidKpis, PendingKpis } from "../../lib/finance";

/**
 * D-24 07c: the Pendientes/Pagados/Finanzas KPI rows, recomputed client-side over whatever rows
 * are currently visible (period + estado de pago + búsqueda).
 *
 * This reads straight off each `FinanceRow`'s own precomputed totals (`reserve`, `outstanding`,
 * `collected`, `overdue`) instead of calling `lib/finance.ts`'s `pendingKpis`/`paidKpis`/
 * `financeSummary` again: those recompute the same totals from `reserveType`/`reserveValue`,
 * which `FinanceRow` does not carry (`FinanceService.getBoard` already resolved them once).
 * Recomputing from scratch here would silently fall back to the default reserve share for every
 * row that set a custom one.
 */
export function recomputePendingKpis(rows: readonly FinanceRow[]): PendingKpis {
  const kpis: PendingKpis = {
    montoPendiente: 0,
    documentosPendientes: 0,
    pedidosPendientes: 0,
    reservasPendientes: 0,
    montoReservasPendientes: 0,
    montoVencido: 0,
    documentosVencidos: 0,
  };

  for (const row of rows) {
    kpis.montoPendiente += row.outstanding;
    kpis.documentosPendientes++;
    kpis.pedidosPendientes++;

    if (!row.reservePaid) {
      kpis.reservasPendientes++;
      kpis.montoReservasPendientes += row.reserve;
    }

    if (row.overdue) {
      kpis.montoVencido += row.outstanding;
      kpis.documentosVencidos++;
    }
  }

  return kpis;
}

/** The average divides by the row count, so an empty period gives 0, not NaN. */
export function recomputePaidKpis(rows: readonly FinanceRow[]): PaidKpis {
  const cobradoPeriodo = rows.reduce((sum, row) => sum + row.total, 0);
  return {
    cobradoPeriodo,
    pedidosPagados: rows.length,
    ticketPromedio:
      rows.length > 0 ? Math.round(cobradoPeriodo / rows.length) : 0,
  };
}

export function recomputeSummary(
  pendingRows: readonly FinanceRow[],
  paidRows: readonly FinanceRow[],
): FinanceSummary {
  const all = [...pendingRows, ...paidRows];
  const ingresosPeriodo = all.reduce((sum, row) => sum + row.total, 0);
  const cobrosRecibidos = all.reduce((sum, row) => sum + row.collected, 0);

  return {
    ingresosPeriodo,
    cobrosRecibidos,
    porCobrar: ingresosPeriodo - cobrosRecibidos,
    tasaCobranza:
      ingresosPeriodo > 0
        ? Math.round((cobrosRecibidos / ingresosPeriodo) * 100)
        : 0,
  };
}
