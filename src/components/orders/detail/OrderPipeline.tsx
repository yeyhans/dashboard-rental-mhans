import { Fragment } from "react";
import { Check, X } from "lucide-react";
import { cn } from "../../../lib/utils";
import { orderPipelineSteps, type PipelineStepState } from "../orderDetail";

const CIRCLE_CLASS: Record<PipelineStepState, string> = {
  done: "border-2 border-[var(--color-text-primary)] bg-[var(--color-text-primary)] text-white",
  active:
    "border-[2.5px] border-[var(--color-text-primary)] bg-[var(--color-surface)] font-bold text-[var(--color-text-primary)] shadow-[0_0_0_4px_rgba(10,10,10,0.07)]",
  pending:
    "border-2 border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-faint)]",
  cancelled:
    "border-2 border-[var(--color-crit)] bg-[var(--color-crit-bg)] text-[var(--color-crit)]",
};

const LABEL_CLASS: Record<PipelineStepState, string> = {
  done: "text-[var(--color-text-secondary)]",
  active: "font-semibold text-[var(--color-text-primary)]",
  pending: "text-[var(--color-text-faint)]",
  cancelled: "font-semibold text-[var(--color-crit)]",
};

/** Canon RC2.1.2 `.pipeline-wrap`: the order's stage along the v1.2 chain. */
export function OrderPipeline({ status }: { status: string }) {
  const steps = orderPipelineSteps(status);

  return (
    <div className="mb-4 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
      <ol
        aria-label="Etapas del pedido"
        className="m-0 flex min-w-max list-none items-start p-0"
      >
        {steps.map((step, index) => (
          <Fragment key={step.key}>
            {index > 0 && (
              <li
                aria-hidden="true"
                className={cn(
                  "mx-0.5 h-0.5 min-w-[18px] flex-1 translate-y-[13px]",
                  step.state === "done" || step.state === "active"
                    ? "bg-[var(--color-text-primary)]"
                    : "bg-[var(--color-border)]",
                )}
              />
            )}
            <li
              data-state={step.state}
              aria-current={step.state === "active" ? "step" : undefined}
              className="flex w-[88px] flex-none flex-col items-center gap-[5px]"
            >
              <span
                className={cn(
                  "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                  CIRCLE_CLASS[step.state],
                )}
              >
                {step.state === "done" ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : step.state === "cancelled" ? (
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  step.number
                )}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-center text-[9px] leading-[1.3]",
                  LABEL_CLASS[step.state],
                )}
              >
                {step.label}
              </span>
            </li>
          </Fragment>
        ))}
      </ol>
    </div>
  );
}
