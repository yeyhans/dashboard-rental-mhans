import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface KpiCardProps {
  /** A lucide-react icon component (or compatible: takes `className`). */
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  footer?: ReactNode;
  className?: string;
}

/**
 * Shared KPI card (D-03, canonical pattern P7): circular icon + label + value + optional footer.
 * Base for the KPI rows in D-04..D-11.
 */
export function KpiCard({
  icon: Icon,
  label,
  value,
  footer,
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-card p-4", className)}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">
            {label}
          </p>
          <p className="text-lg font-semibold text-foreground">{value}</p>
        </div>
      </div>
      {footer && (
        <div className="mt-3 text-xs text-muted-foreground">{footer}</div>
      )}
    </div>
  );
}
