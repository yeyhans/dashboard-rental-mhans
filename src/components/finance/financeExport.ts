import type { FinanceRow } from "../../services/financeService";
import { financePaymentTone } from "./financePaymentTone";

/** `orders.date_paid`/`order_fecha_termino`-shaped ISO day → DD/MM/YYYY, project convention. */
export function formatDay(value: string | null): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

const PENDING_HEADER = [
  "ID Pedido",
  "Cliente",
  "Proyecto",
  "Total",
  "Reserva",
  "Saldo Pendiente",
  "OC",
  "Factura",
  "Estado",
];

const PAID_HEADER = [
  "ID Pedido",
  "Cliente",
  "Proyecto",
  "Fecha Pago",
  "Total",
  "OC",
  "Factura",
];

function pendingLine(row: FinanceRow): string[] {
  return [
    row.reference,
    row.client,
    row.project,
    String(row.total),
    String(row.reserve),
    String(row.outstanding),
    row.purchaseOrder || "—",
    row.invoiceNumber || "—",
    financePaymentTone(row).label,
  ];
}

function paidLine(row: FinanceRow): string[] {
  return [
    row.reference,
    row.client,
    row.project,
    formatDay(row.paidAt),
    String(row.total),
    row.purchaseOrder || "—",
    row.invoiceNumber || "—",
  ];
}

/**
 * D-10 "Exportar": client-side CSV of the rows currently loaded/filtered in the board, no new
 * dependency. Only Pendientes and Pagados have row-level data to export — Finanzas is a summary
 * tab with no table, so it is not offered a CSV (see `FinanceBoard`'s Exportar button).
 */
export function financeRowsToCsv(
  rows: FinanceRow[],
  tab: "pendientes" | "pagados",
): string {
  const header = tab === "pendientes" ? PENDING_HEADER : PAID_HEADER;
  const toLine = tab === "pendientes" ? pendingLine : paidLine;
  const lines = [
    header.join(","),
    ...rows.map((row) => toLine(row).map(csvEscape).join(",")),
  ];
  return lines.join("\n");
}
