import { isStatusJump } from "../../lib/orderTransitionGate";
import type { OrderStatus } from "../../lib/orderStatus";

/**
 * The status change flow of the order detail (admin status jump, 2026-10-14,
 * `odd/tasks/admin-status-jump.md`), kept free of React and the DOM so it is tested directly (no
 * jsdom in this project). `OrderStatusQuickActions` builds the requests and reacts to the
 * outcome; `ProcessOrder` sends them through `executeStatusChange`.
 */

export interface StatusChangeRequest {
  status: OrderStatus;
  notify?: boolean;
  reason?: string;
  acknowledgeOpenCheckouts?: boolean;
}

export type StatusChangeOutcome =
  | { ok: true }
  | { ok: false; error: string; code?: string; assetTags?: string[] };

/**
 * The notify checkbox shows for exactly the changes the server holds the email back on: the
 * same classifier as the lifecycle (`isStatusJump`), legacy-origin rule included.
 */
export function shouldOfferNotify(from: unknown, to: unknown): boolean {
  return isStatusJump(from, to);
}

/** Reads the status route's JSON answer into an outcome the dialogs can act on. */
export function readStatusChangeResponse(
  httpStatus: number,
  body: unknown,
): StatusChangeOutcome {
  const result = (body ?? {}) as {
    success?: boolean;
    error?: string;
    code?: string;
    data?: { asset_tags?: unknown };
  };
  if (httpStatus >= 200 && httpStatus < 300 && result.success) {
    return { ok: true };
  }
  const assetTags = Array.isArray(result.data?.asset_tags)
    ? result.data.asset_tags.filter(
        (tag): tag is string => typeof tag === "string",
      )
    : undefined;
  return {
    ok: false,
    error: result.error || "No se pudo actualizar el estado de la orden",
    ...(result.code ? { code: result.code } : {}),
    ...(assetTags ? { assetTags } : {}),
  };
}

/* ---------------------------------------------------------------------------------------------
 * Requests built by the quick actions
 * ------------------------------------------------------------------------------------------- */

/** "Avanzar a <siguiente>". */
export function buildAdvanceRequest(to: OrderStatus): StatusChangeRequest {
  return { status: to };
}

/** "Cancelar pedido", with the reason trimmed and dropped when blank. */
export function buildCancelRequest(reason: string): StatusChangeRequest {
  const trimmed = reason.trim();
  return { status: "cancelled", ...(trimmed ? { reason: trimmed } : {}) };
}

/**
 * "Cambiar estado…". `notify` only travels when the change is a jump (a stale tick on a
 * sequential change is dropped); the reason only when the target is `cancelled`.
 */
export function buildJumpRequest(input: {
  currentStatus: unknown;
  target: OrderStatus;
  notify: boolean;
  reason: string;
}): StatusChangeRequest {
  const { currentStatus, target, notify, reason } = input;
  const trimmed = reason.trim();
  return {
    status: target,
    ...(notify && shouldOfferNotify(currentStatus, target) ? { notify: true } : {}),
    ...(target === "cancelled" && trimmed ? { reason: trimmed } : {}),
  };
}

/** "Confirmar de todos modos": the same request, acknowledging the units still out. */
export function acknowledgeOpenCheckouts(
  request: StatusChangeRequest,
): StatusChangeRequest {
  return { ...request, acknowledgeOpenCheckouts: true };
}

export type SubmitResult =
  | { kind: "done" }
  | { kind: "confirm-open-checkouts"; request: StatusChangeRequest; assetTags: string[] }
  | { kind: "error"; error: string };

/**
 * One submit of the quick actions: success closes the dialogs, a first `OPEN_CHECKOUTS` asks
 * the admin to confirm, anything else (an acknowledged request that still conflicts included)
 * is an error to show.
 */
export async function submitStatusChange(
  request: StatusChangeRequest,
  onChangeStatus: (request: StatusChangeRequest) => Promise<StatusChangeOutcome>,
): Promise<SubmitResult> {
  const outcome = await onChangeStatus(request);
  if (outcome.ok) return { kind: "done" };
  if (outcome.code === "OPEN_CHECKOUTS" && !request.acknowledgeOpenCheckouts) {
    return { kind: "confirm-open-checkouts", request, assetTags: outcome.assetTags ?? [] };
  }
  return { kind: "error", error: outcome.error };
}

/* ---------------------------------------------------------------------------------------------
 * Request to the status route, owned by ProcessOrder
 * ------------------------------------------------------------------------------------------- */

/** The body of `PUT /api/orders/[id]/status`. */
export function statusChangeBody(request: StatusChangeRequest) {
  return {
    status: request.status,
    ...(request.reason ? { reason: request.reason } : {}),
    notify: request.notify === true,
    acknowledge_open_checkouts: request.acknowledgeOpenCheckouts === true,
  };
}

export interface StatusChangeExecution {
  outcome: StatusChangeOutcome;
  /** The route's own warning (e.g. the email could not be sent). */
  warning?: string;
  /** The status changed, but the follow-up (order-chat note) failed. Never a failed change. */
  followUpError?: string;
}

/**
 * Sends a status change and, once the route committed it, posts the order-chat note. The note
 * reaches the customer too, so a jump without "Notificar al cliente" stays silent. A failure
 * after the commit is reported as `followUpError`, never as a failed status change: the order
 * already moved, and saying otherwise sends the admin to retry a change that happened.
 */
export async function executeStatusChange(
  from: unknown,
  request: StatusChangeRequest,
  deps: {
    send: (
      body: ReturnType<typeof statusChangeBody>,
    ) => Promise<{ httpStatus: number; body: unknown }>;
    postChatNote: () => Promise<unknown>;
    onUnexpectedError?: (stage: "request" | "follow-up", error: unknown) => void;
  },
): Promise<StatusChangeExecution> {
  let response: { httpStatus: number; body: unknown };
  try {
    response = await deps.send(statusChangeBody(request));
  } catch (error) {
    deps.onUnexpectedError?.("request", error);
    return {
      outcome: {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error al cambiar el estado de la orden",
      },
    };
  }

  const outcome = readStatusChangeResponse(response.httpStatus, response.body);
  if (!outcome.ok) return { outcome };

  const routeWarning = (response.body as { warning?: unknown } | null)?.warning;
  const execution: StatusChangeExecution = {
    outcome,
    ...(typeof routeWarning === "string" && routeWarning ? { warning: routeWarning } : {}),
  };

  if (request.notify === true || !isStatusJump(from, request.status)) {
    try {
      await deps.postChatNote();
    } catch (error) {
      deps.onUnexpectedError?.("follow-up", error);
      const detail = error instanceof Error && error.message ? ` (${error.message})` : "";
      execution.followUpError = `El estado se cambió, pero no se pudo publicar la nota en el chat del pedido${detail}.`;
    }
  }
  return execution;
}
