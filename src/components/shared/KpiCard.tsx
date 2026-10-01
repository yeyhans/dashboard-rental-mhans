import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { hasSlotContent } from "./slotContent";
import { sparklinePoints } from "../../lib/sparkline";

interface KpiCardProps {
  /**
   * A lucide-react icon component (or compatible: takes `className`). Optional: D-06 Check-In
   * KPIs are the one canon module that shows no icon at all, so the circular wrapper only renders
   * when a caller passes one.
   */
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  /** Usually a plain number/string; a `ReactNode` lets a caller wrap it for semantic tone color. */
  value: ReactNode;
  footer?: ReactNode;
  /**
   * D-24 07d: an optional tiny trend line, fed by per-period buckets the caller already computed
   * (e.g. `monthlyBucketSums`) — a plain inline SVG `<polyline>`, no new chart dependency. Omitted
   * by every existing caller, so this is backward compatible.
   */
  sparkline?: readonly number[];
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
  sparkline,
  className,
}: KpiCardProps) {
  const points =
    sparkline && sparkline.length > 1
      ? sparklinePoints(sparkline, 56, 18)
      : null;

  return (
    <div
      className={cn("rounded-lg border border-border bg-card p-4", className)}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-muted-foreground">
            {label}
          </p>
          <p className="text-lg font-semibold text-foreground">{value}</p>
        </div>
        {points && (
          <svg
            width="56"
            height="18"
            viewBox="0 0 56 18"
            className="shrink-0 text-muted-foreground"
            aria-hidden="true"
          >
            <polyline
              points={points}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
      {hasSlotContent(footer) && (
        <div className="mt-3 text-xs text-muted-foreground">{footer}</div>
      )}
    </div>
  );
}
