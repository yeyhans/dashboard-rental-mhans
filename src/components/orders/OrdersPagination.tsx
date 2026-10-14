import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

export type PaginationItem = number | "ellipsis";

/** Canon `#pag-info`: "Mostrando 1 a 8 de 38 pedidos", over the filtered list. */
export function paginationLabel(
  currentPage: number,
  pageSize: number,
  totalItems: number,
): string {
  if (totalItems <= 0) return "Mostrando 0 de 0 pedidos";
  const start = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const end = Math.min(currentPage * pageSize, totalItems);
  return `Mostrando ${start} a ${end} de ${totalItems} ${totalItems === 1 ? "pedido" : "pedidos"}`;
}

/**
 * The page buttons to show (canon `.pag`: "1 2 3 … 5"): every page up to five, otherwise the
 * first, the last and the current page with its neighbours, gaps collapsed into an ellipsis — a
 * gap of a single page shows that page instead, since "…" would take the same room.
 */
export function paginationItems(
  currentPage: number,
  totalPages: number,
): PaginationItem[] {
  if (totalPages <= 0) return [];
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set([
    1,
    totalPages,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ]);
  if (currentPage <= 2) [2, 3].forEach((p) => pages.add(p));
  if (currentPage >= totalPages - 1)
    [totalPages - 1, totalPages - 2].forEach((p) => pages.add(p));

  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const items: PaginationItem[] = [];
  sorted.forEach((page, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined) {
      if (page - previous === 2) items.push(previous + 1);
      else if (page - previous > 2) items.push("ellipsis");
    }
    items.push(page);
  });
  return items;
}

const PAGE_BUTTON_CLASS =
  "inline-flex h-7 w-7 items-center justify-center rounded-[5px] border border-border bg-background text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45";

interface OrdersPaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

/** Canon RC2.1.2 `.pag-row`: range label on the left, 28px square page buttons on the right. */
export function OrdersPagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  disabled = false,
}: OrdersPaginationProps) {
  return (
    <nav
      aria-label="Paginación de pedidos"
      className="flex flex-col items-start gap-2.5 py-3 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between"
    >
      <span>{paginationLabel(currentPage, pageSize, totalItems)}</span>
      {totalPages > 1 && (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className={cn(PAGE_BUTTON_CLASS, "hover:bg-muted")}
            onClick={() => onPageChange(currentPage - 1)}
            disabled={disabled || currentPage <= 1}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          {paginationItems(currentPage, totalPages).map((item, index) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="inline-flex h-7 w-7 items-center justify-center"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                className={cn(
                  PAGE_BUTTON_CLASS,
                  item === currentPage
                    ? "border-foreground bg-foreground text-background"
                    : "text-foreground hover:bg-muted",
                )}
                onClick={() => onPageChange(item)}
                disabled={disabled}
                aria-label={`Ir a página ${item}`}
                aria-current={item === currentPage ? "page" : undefined}
              >
                {item}
              </button>
            ),
          )}
          <button
            type="button"
            className={cn(PAGE_BUTTON_CLASS, "hover:bg-muted")}
            onClick={() => onPageChange(currentPage + 1)}
            disabled={disabled || currentPage >= totalPages}
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </nav>
  );
}
