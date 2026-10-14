import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StatusBadge } from "../../shared/StatusBadge";
import { statusLabel } from "../../../lib/orderStatus";
import { toBadgeTone } from "../orderListMetrics";

/**
 * Canon RC2.1.2 `.breadcrumb` + `.det-header`. The number is the order id: the data has no
 * separate operational folio. Actions are passed in by the container (`ProcessOrder`).
 */
export function OrderDetailHeader({
  orderId,
  project,
  clientLine,
  createdLabel,
  status,
  actions,
  backHref = "/orders",
}: {
  orderId: number | string;
  project?: string | null;
  clientLine?: string;
  createdLabel?: string;
  status: string;
  actions?: ReactNode;
  backHref?: string;
}) {
  const crumb = project ? `#${orderId} · ${project}` : `#${orderId}`;

  return (
    <>
      <nav
        aria-label="Ruta"
        className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-text-faint)]"
      >
        <a
          href={backHref}
          className="mr-1 inline-flex items-center gap-[5px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-[5px] text-[11px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Volver
        </a>
        <a
          href={backHref}
          className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          Pedidos
        </a>
        <ChevronRight
          className="h-3.5 w-3.5 text-[var(--color-border-strong)]"
          aria-hidden="true"
        />
        <span
          aria-current="page"
          className="font-medium text-[var(--color-text-primary)]"
        >
          {crumb}
        </span>
      </nav>

      <header className="mb-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-5 md:px-6">
        <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-1.5">
            <h1 className="m-0 font-mono text-[20px] font-bold leading-none tracking-[0.02em] text-[var(--color-text-primary)]">
              #{orderId}
            </h1>
            {project && (
              <div className="mt-0.5 text-base font-semibold text-[var(--color-text-primary)]">
                {project}
              </div>
            )}
            {clientLine && (
              <div className="text-xs text-[var(--color-text-secondary)]">
                {clientLine}
              </div>
            )}
            {createdLabel && (
              <div className="text-[11px] text-[var(--color-text-faint)]">
                {createdLabel}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                variant="canon"
                tone={toBadgeTone(status)}
                label={statusLabel(status)}
              />
            </div>
          </div>
          {actions && (
            <div className="flex flex-wrap gap-1.5 md:justify-end [&>*]:flex-1 md:[&>*]:flex-none">
              {actions}
            </div>
          )}
        </div>
      </header>
    </>
  );
}
