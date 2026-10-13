/**
 * What an operator (garage worker) may do to an order's status from the bodega sheet.
 *
 * Owner decision 2026-10-02: forward only, one step at a time, along the part of the chain the
 * garage physically drives: confirmed -> preparation -> in-rental -> return. An operator never
 * completes or cancels an order and never moves one backwards; those stay admin work. Passing to
 * preparation without the reserve paid is deliberately allowed (A-06 accepted).
 *
 * The general state machine (`lib/orderStatus.ts#canTransition`) still runs for every role; this
 * is the extra, narrower allowlist applied on top of it for `operator`.
 *
 * R-04b (owner decision 2026-10-13): an operator may also close a return, `return -> completed`,
 * but ONLY from the reception flow (`POST /api/bodega/orders/[id]/finalize`), which saves the
 * return report with it. That caller opts in with `{ allowClosing: true }`; the plain status route
 * does not, so a return is never closed by an operator without its report. The closing step is
 * deliberately not in `OPERATOR_STATUS_STEPS`: that map drives the bodega "next step" button.
 */

export const OPERATOR_STATUS_STEPS: Readonly<Record<string, string>> = {
  confirmed: "preparation",
  preparation: "in-rental",
  "in-rental": "return",
};

export const OPERATOR_STATUS_ERRORS = {
  NOT_ALLOWED:
    "Como operario solo puedes avanzar el pedido al siguiente paso de bodega.",
} as const;

/** The one extra step an operator may take, and only from the finalize flow. */
export const OPERATOR_CLOSING_STEP = {
  from: "return",
  to: "completed",
} as const;

export interface OperatorStatusResult {
  valid: boolean;
  error?: string;
}

/** The single status an operator may move this order to, or `null`. */
export function operatorNextStatus(
  current: string | null | undefined,
): string | null {
  if (typeof current !== "string") return null;
  return Object.prototype.hasOwnProperty.call(OPERATOR_STATUS_STEPS, current)
    ? OPERATOR_STATUS_STEPS[current]!
    : null;
}

export function validateOperatorStatusChange(
  from: string | null | undefined,
  to: string | null | undefined,
  options: { allowClosing?: boolean } = {},
): OperatorStatusResult {
  const allowed = operatorNextStatus(from);
  if (allowed !== null && allowed === to) return { valid: true };
  if (
    options.allowClosing === true &&
    from === OPERATOR_CLOSING_STEP.from &&
    to === OPERATOR_CLOSING_STEP.to
  ) {
    return { valid: true };
  }
  return { valid: false, error: OPERATOR_STATUS_ERRORS.NOT_ALLOWED };
}
