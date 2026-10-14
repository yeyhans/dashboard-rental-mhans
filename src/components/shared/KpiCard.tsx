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
  /** 01.1: when the KPI has a destination, the footer shows a "Ver detalle" link to it. */
  href?: string;
  className?: string;
  /**
   * Opt-in canon geometry from Pedidos RC2.1.2 `.kpi-card`: 30px icon beside an 11px label,
   * 28px bold value, faint meta line. `default` keeps the original layout for every other caller.
   */
  variant?: "default" | "canon";
  /** Canon variant only: the faint line under the value (e.g. "Programados →"). */
  meta?: ReactNode;
  /** Canon variant only: makes the whole card a button (the canon's KPI → tab filter). */
  onClick?: () => void;
  /** Canon variant only: exposes the card's filter as pressed while its tab is active. */
  isActive?: boolean;
}

type CanonKpiCardProps = Pick<
  KpiCardProps,
  "icon" | "label" | "value" | "meta" | "onClick" | "isActive" | "className"
>;

function CanonKpiCard({
  icon: Icon,
  label,
  value,
  meta,
  onClick,
  isActive,
  className,
}: CanonKpiCardProps) {
  const body = (
    <>
      <div className="mb-2 flex items-center gap-2">
        {Icon && (
          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <p className="text-[11px] leading-tight text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mb-[3px] text-[28px] font-bold leading-none tracking-[-0.03em] text-foreground">
        {value}
      </p>
      {hasSlotContent(meta) && (
        <p className="text-[11px] text-[var(--color-text-faint)]">{meta}</p>
      )}
    </>
  );
  const frame = cn(
    "block w-full rounded-[10px] border border-border bg-card px-[18px] py-4 text-left",
    className,
  );

  if (!onClick) return <div className={frame}>{body}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive ?? false}
      className={cn(
        frame,
        "transition-colors hover:border-[var(--color-border-strong)] hover:bg-[#FDFCF9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isActive && "border-[var(--color-border-strong)]",
      )}
    >
      {body}
    </button>
  );
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
  href,
  className,
  variant = "default",
  meta,
  onClick,
  isActive,
}: KpiCardProps) {
  if (variant === "canon") {
    return (
      <CanonKpiCard
        icon={Icon}
        label={label}
        value={value}
        meta={meta}
        onClick={onClick}
        isActive={isActive}
        className={className}
      />
    );
  }

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
          {/* 01.1: the label wraps to two lines instead of being cut mid-word. */}
          <p className="line-clamp-2 text-xs font-medium leading-tight text-muted-foreground">
            {label}
          </p>
          <p className="break-words font-mono text-lg font-semibold text-foreground">
            {value}
          </p>
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
      {(hasSlotContent(footer) || href) && (
        <div className="mt-3 text-xs text-muted-foreground">
          {footer}
          {href && (
            <a
              href={href}
              className="block font-medium text-foreground underline-offset-2 hover:underline"
            >
              Ver detalle
            </a>
          )}
        </div>
      )}
    </div>
  );
}
