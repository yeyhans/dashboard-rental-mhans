/**
 * Generic CSV helpers (D-24).
 *
 * `financeExport.ts` (D-16/D-18) already worked out the quoting, BOM and blob-string rules for
 * the Finanzas "Exportar" button. Pulled out here so Rentabilidad's export (08d) reuses the exact
 * same rules instead of re-deriving them, per the task's own instruction to reuse the Finanzas
 * CSV helper.
 */

/** Quotes a field containing a comma, a double quote, or a line break; doubles embedded quotes. */
export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Builds a CSV body (header row + data rows), escaping every cell. */
export function rowsToCsv(
  header: readonly string[],
  rows: readonly string[][],
): string {
  const lines = [
    header.join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ];
  return lines.join("\n");
}

/** UTF-8 BOM so Excel opens the CSV with the right encoding instead of mangling accents. */
export const CSV_BOM = "﻿";

/** The exact string handed to the export `Blob`: the BOM-prefixed CSV. */
export function buildCsvBlob(csv: string): string {
  return CSV_BOM + csv;
}
