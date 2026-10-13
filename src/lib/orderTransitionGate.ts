import { validateOperatorStatusChange } from "./operatorOrderStatus";
import {
  canTransition,
  isOrderStatus,
  nextStatus,
  statusLabel,
} from "./orderStatus";

/**
 * The status-change gate shared by every route that writes `orders.status`
 * (`PUT /api/orders/[id]/status` and `PUT /api/orders/update/[id]`). Each route used to carry its
 * own copy, and two copies of a rule drift.
 *
 * Two checks, in this order:
 *  1. An operator (bodega) may only take the next bodega step (owner decision 2026-10-02).
 *  2. The state machine (`canTransition`). A legacy origin is not judged: the machine does not
 *     know it, and blocking those rows would freeze the panel while they are migrated by hand.
 *
 * Returns `null` when the change is allowed, or the HTTP rejection to send.
 */
export interface StatusChangeRejection {
  status: 403 | 409;
  code: "OPERATOR_TRANSITION_FORBIDDEN" | "INVALID_TRANSITION";
  error: string;
}

export function checkStatusChange(input: {
  from: unknown;
  to: unknown;
  role?: string | null;
  /** Only the return finalize flow sets this: it lets an operator take `return -> completed`. */
  allowOperatorClosing?: boolean;
}): StatusChangeRejection | null {
  const { from, to, role, allowOperatorClosing = false } = input;

  if (role === "operator") {
    const gate = validateOperatorStatusChange(
      typeof from === "string" ? from : null,
      typeof to === "string" ? to : null,
      { allowClosing: allowOperatorClosing },
    );
    if (!gate.valid) {
      return {
        status: 403,
        code: "OPERATOR_TRANSITION_FORBIDDEN",
        error: gate.error ?? "Cambio de estado no permitido.",
      };
    }
  }

  if (!isOrderStatus(from)) return null;
  if (isOrderStatus(to) && canTransition(from, to)) return null;

  const legal = nextStatus(from);
  const detail = legal
    ? `Desde "${statusLabel(from)}" solo se puede avanzar a "${statusLabel(legal)}" o cancelar.`
    : `"${statusLabel(from)}" es un estado terminal y no admite cambios.`;

  return {
    status: 409,
    code: "INVALID_TRANSITION",
    error: `Transición de estado no permitida. ${detail}`,
  };
}
