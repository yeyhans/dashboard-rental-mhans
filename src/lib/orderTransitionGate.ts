import { FULL_ACCESS_ROLES } from "./accessControl";
import { validateOperatorStatusChange } from "./operatorOrderStatus";
import {
  canTransition,
  canonicalStatus,
  isOrderStatus,
  nextStatus,
  statusLabel,
  type OrderStatus,
} from "./orderStatus";

/**
 * The status-change gate shared by every route that writes `orders.status`
 * (`PUT /api/orders/[id]/status` and `PUT /api/orders/update/[id]`). Each route used to carry its
 * own copy, and two copies of a rule drift.
 *
 * Checks, in this order:
 *  1. An operator (bodega) may only take the next bodega step (owner decision 2026-10-02).
 *  2. Re-sending the current status is not a change (409 `SAME_STATUS`).
 *  3. admin and super_admin may move an order from any status to any other, terminal states
 *     included (owner decision 2026-10-14). A move the state machine would reject is a "jump":
 *     the routes send its customer email only when the admin asks for it.
 *  4. The state machine (`canTransition`) for every other role. A legacy origin is not judged:
 *     the machine does not know it, and blocking those rows would freeze the panel while they
 *     are migrated by hand.
 *
 * Returns `null` when the change is allowed, or the HTTP rejection to send.
 */
export interface StatusChangeRejection {
  status: 403 | 409;
  code: "OPERATOR_TRANSITION_FORBIDDEN" | "INVALID_TRANSITION" | "SAME_STATUS";
  error: string;
}

/** Whether `role` may jump an order to any status (admin, super_admin). */
export function canJumpStatus(role: string | null | undefined): boolean {
  return (
    typeof role === "string" &&
    (FULL_ACCESS_ROLES as readonly string[]).includes(role)
  );
}

/**
 * Whether the change follows the state machine (next stage, or cancel from a non-terminal stage).
 * Anything else an admin does is a jump. Values outside the vocabulary are never sequential.
 */
export function isSequentialTransition(from: unknown, to: unknown): boolean {
  return isOrderStatus(from) && isOrderStatus(to) && canTransition(from, to);
}

const PRE_RENTAL_STATUSES: readonly OrderStatus[] = [
  "request",
  "evaluation",
  "confirmed",
  "preparation",
];
const OUT_ON_RENT_STATUSES: readonly OrderStatus[] = ["in-rental", "return"];

/**
 * Whether the change must first look for units still checked out to the order: closing it
 * (`completed`/`cancelled`), or sending an order that is out on rent back to a pre-rental stage.
 * Either one leaves a serialised unit marked as "out" against an order that no longer expects it.
 */
export function requiresOpenCheckoutCheck(from: unknown, to: unknown): boolean {
  const target = canonicalStatus(to);
  if (target === "completed" || target === "cancelled") return true;
  const origin = canonicalStatus(from);
  return (
    origin !== null &&
    target !== null &&
    OUT_ON_RENT_STATUSES.includes(origin) &&
    PRE_RENTAL_STATUSES.includes(target)
  );
}

/** Longest `reason` the status routes accept (it is stored as `orders.cancellation_reason`). */
export const STATUS_REASON_MAX_LENGTH = 500;

export interface StatusChangeOptions {
  /** Send the target status email on a jump (sequential changes always send). */
  notify: boolean;
  /** Trimmed reason, `undefined` when absent or blank. */
  reason?: string;
  /** The admin saw the units still checked out and confirmed anyway. */
  acknowledgeOpenCheckouts: boolean;
}

/**
 * Reads the optional fields of a status change body (`notify`, `reason`,
 * `acknowledge_open_checkouts`). Only a literal `true` turns a flag on. Returns the error to send
 * as a 400 when `reason` is not text or is too long.
 */
export function parseStatusChangeOptions(
  body: unknown,
): StatusChangeOptions | { error: string } {
  const raw = (body ?? {}) as Record<string, unknown>;
  let reason: string | undefined;
  if (raw.reason !== undefined && raw.reason !== null) {
    if (typeof raw.reason !== "string") {
      return { error: "El motivo debe ser texto." };
    }
    const trimmed = raw.reason.trim();
    if (trimmed.length > STATUS_REASON_MAX_LENGTH) {
      return {
        error: `El motivo no puede superar los ${STATUS_REASON_MAX_LENGTH} caracteres.`,
      };
    }
    reason = trimmed || undefined;
  }
  return {
    notify: raw.notify === true,
    ...(reason ? { reason } : {}),
    acknowledgeOpenCheckouts: raw.acknowledge_open_checkouts === true,
  };
}

/** The 409 body for an order that still has units out (`OPEN_CHECKOUTS`). */
export function openCheckoutsRejection(assetTags: string[]) {
  return {
    success: false as const,
    code: "OPEN_CHECKOUTS" as const,
    error: `La orden tiene ${assetTags.length} ${assetTags.length === 1 ? "unidad" : "unidades"} sin devolver: ${assetTags.join(", ")}. Confirma para cambiar el estado de todos modos.`,
    data: { asset_tags: assetTags },
  };
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

  if (typeof from === "string" && from === to) {
    return {
      status: 409,
      code: "SAME_STATUS",
      error: `La orden ya está en "${statusLabel(from)}".`,
    };
  }

  // The jump is to any status of the vocabulary; a value outside it still falls to the machine.
  if (canJumpStatus(role) && isOrderStatus(to)) return null;

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
