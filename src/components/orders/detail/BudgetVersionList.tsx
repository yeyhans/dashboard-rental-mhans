import { Trash2 } from "lucide-react";
import { cn } from "../../../lib/utils";
import type { BudgetVersion } from "../orderDetail";

/**
 * Canon RC2.1.2 `.ver-row` list for the budget PDFs stored in `new_pdf_on_hold_url`. The canon's
 * per-version date, author, amount and item count are not stored, so each row shows only the
 * version, the current tag and its actions.
 */
export function BudgetVersionList({
  versions,
  onOpen,
  onDelete,
  disabled = false,
}: {
  versions: readonly BudgetVersion[];
  onOpen: (url: string) => void;
  onDelete: (url: string) => void;
  disabled?: boolean;
}) {
  return (
    <ul className="m-0 list-none p-0">
      {versions.map((version) => (
        <li
          key={version.url}
          className="flex items-center gap-2.5 border-b border-[var(--color-border-soft)] px-[14px] py-[9px] transition-colors last:border-b-0 hover:bg-[var(--color-surface-2)]"
        >
          <span className="min-w-[30px] font-mono text-[10px] text-[var(--color-text-faint)]">
            v{version.version}
          </span>
          <span
            aria-hidden="true"
            className={cn(
              "h-2 w-2 flex-shrink-0 rounded-full",
              version.isCurrent
                ? "bg-[var(--color-ok)]"
                : "bg-[var(--color-border-strong)]",
            )}
          />
          <span className="min-w-0 flex-1 text-xs text-[var(--color-text-primary)]">
            Presupuesto
            {version.isCurrent && (
              <span className="ml-[5px] rounded-[10px] bg-[var(--color-ok-bg)] px-1.5 py-px text-[10px] font-semibold text-[var(--color-ok)]">
                Actual
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => onOpen(version.url)}
            className="whitespace-nowrap rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-[3px] text-[11px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
          >
            Ver
          </button>
          <button
            type="button"
            onClick={() => onDelete(version.url)}
            disabled={disabled}
            aria-label={`Eliminar presupuesto v${version.version}`}
            title="Eliminar versión"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--color-crit)] hover:bg-[var(--color-crit-bg)] disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
