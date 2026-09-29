import type { FinanceRow } from "../../services/financeService";
import { financePaymentTone } from "./financePaymentTone";
import { businessDay } from "../../lib/businessDay";

/** `orders.date_paid`/`order_fecha_termino`-shaped ISO day → DD/MM/YYYY, project convention. */
export function formatDay(value: string | null): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
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

/** UTF-8 BOM so Excel opens the CSV with the right encoding instead of mangling accents. */
const CSV_BOM = "﻿";

/**
 * D-18: the exact string handed to the export `Blob` — the BOM-prefixed CSV — pulled out of
 * `FinanceBoard.handleExport` so it is unit-testable without a `Blob`/DOM.
 */
export function buildFinanceExportBlob(csv: string): string {
  return CSV_BOM + csv;
}

/**
 * D-18: the download filename for the Exportar button, pulled out of
 * `FinanceBoard.handleExport`. The date is the Chilean business day (D-16, R3-104), not the
 * server's UTC one — Vercel runs in UTC, so naming the file with `new Date()`'s own getters would
 * be one day ahead for the last few hours of each Chilean working day.
 */
export function buildFinanceExportFilename(
  tab: "pendientes" | "pagados",
  now: Date,
): string {
  return `finanzas-${tab}-${businessDay(now)}.csv`;
}
