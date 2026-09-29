import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  date?: string;
  actions?: ReactNode;
  className?: string;
}

/**
 * Shared page header (D-03, canonical pattern P6): uppercase H1 + subtitle + date + actions slot.
 * Base for D-04..D-11, one per module page.
 */
export function PageHeader({
  title,
  subtitle,
  date,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div>
        <h1 className="text-xl font-semibold uppercase tracking-wide text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
        {date && <p className="mt-1 text-xs text-muted-foreground">{date}</p>}
      </div>
      {actions !== undefined && actions !== null && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}
