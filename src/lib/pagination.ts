/** Rows per page for the client-side tables (D-5 07.1). */
export const DEFAULT_PAGE_SIZE = 10;

export interface Page<T> {
  items: T[];
  /** The page actually returned, already clamped into `1..totalPages`. */
  page: number;
  totalPages: number;
  total: number;
  /** 1-based index of the first/last row shown; both 0 when the list is empty. */
  from: number;
  to: number;
  hasPrev: boolean;
  hasNext: boolean;
}

/**
 * Slices `rows` into one page. An out-of-range or non-numeric `page` is clamped, so a filter
 * that shrinks the list never leaves the table on a page that no longer exists.
 */
export function paginate<T>(
  rows: readonly T[],
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Page<T> {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const requested = Number.isFinite(page) ? Math.trunc(page) : 1;
  const current = Math.min(Math.max(requested, 1), totalPages);
  const start = (current - 1) * pageSize;
  const items = rows.slice(start, start + pageSize);
  return {
    items,
    page: current,
    totalPages,
    total,
    from: total === 0 ? 0 : start + 1,
    to: total === 0 ? 0 : start + items.length,
    hasPrev: current > 1,
    hasNext: current < totalPages,
  };
}

/** Canon footer text: "Mostrando 1 a 10 de 25 resultados". */
export function paginationLabel(page: Page<unknown>): string {
  if (page.total === 0) return "Mostrando 0 resultados";
  const noun = page.total === 1 ? "resultado" : "resultados";
  return `Mostrando ${page.from} a ${page.to} de ${page.total} ${noun}`;
}
