import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";

/**
 * Canon RC2.1.2 `.card` / `.card-hd` chrome for the order detail screen: white surface, 1px rule,
 * 10px radius, and a surface-2 head with an 11px uppercase tracked title. Local to the detail
 * screen on purpose: `ui/card` keeps its defaults for every other module.
 */
export function DetailCard({
  title,
  icon,
  meta,
  actions,
  children,
  noPad = false,
  className,
  bodyClassName,
}: {
  title: string;
  icon?: ReactNode;
  /** Right side of the head, e.g. a count ("3 equipos"). */
  meta?: ReactNode;
  /** Right side of the head, after `meta`, e.g. an "Editar" button. */
  actions?: ReactNode;
  children: ReactNode;
  noPad?: boolean;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface-2)] px-[14px] py-[11px]">
        <h3 className="m-0 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">
          {icon}
          {title}
        </h3>
        {(meta !== undefined || actions !== undefined) && (
          <div className="flex items-center gap-2">
            {meta !== undefined && (
              <span className="text-[11px] text-[var(--color-text-faint)]">
                {meta}
              </span>
            )}
            {actions}
          </div>
        )}
      </header>
      <div className={cn(noPad ? "p-0" : "p-[14px]", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}

/** Canon `.btn.secondary.sm`: bordered white button, 11px text. */
export const canonSecondaryButtonClass =
  "inline-flex items-center justify-center gap-[5px] whitespace-nowrap rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-[5px] text-[11px] font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-2)] disabled:pointer-events-none disabled:opacity-50";

/** Canon `.btn.danger.sm`: same shape as the secondary button, critical tone. */
export const canonDangerButtonClass =
  "inline-flex items-center justify-center gap-[5px] whitespace-nowrap rounded-[var(--radius-md)] border border-[var(--color-crit-bg)] bg-[var(--color-surface)] px-2.5 py-[5px] text-[11px] font-medium text-[var(--color-crit)] transition-colors hover:bg-[var(--color-crit-bg)] disabled:pointer-events-none disabled:opacity-50";

/** Canon `.btn.primary.sm`: ink button. */
export const canonPrimaryButtonClass =
  "inline-flex items-center justify-center gap-[5px] whitespace-nowrap rounded-[var(--radius-md)] border border-[var(--color-text-primary)] bg-[var(--color-text-primary)] px-2.5 py-[5px] text-[11px] font-semibold text-white transition-colors hover:bg-[var(--color-ink-hover)] disabled:pointer-events-none disabled:opacity-50";
