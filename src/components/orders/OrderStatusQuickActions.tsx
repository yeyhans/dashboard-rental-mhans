import { useState } from "react";
import { ArrowRight, Loader2, Repeat, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  STATUS_REASON_MAX_LENGTH,
  canJumpStatus,
} from "../../lib/orderTransitionGate";
import { operatorNextStatus } from "../../lib/operatorOrderStatus";
import {
  ORDER_STATUSES,
  canonicalStatus,
  isTerminalStatus,
  nextStatus,
  statusLabel,
  type OrderStatus,
} from "../../lib/orderStatus";
import {
  acknowledgeOpenCheckouts,
  buildAdvanceRequest,
  buildCancelRequest,
  buildJumpRequest,
  shouldOfferNotify,
  submitStatusChange,
  type StatusChangeOutcome,
  type StatusChangeRequest,
} from "./statusChangeFlow";

// The flow lives in `statusChangeFlow` (pure, tested without a DOM); re-exported for callers.
export {
  readStatusChangeResponse,
  shouldOfferNotify,
  type StatusChangeOutcome,
  type StatusChangeRequest,
} from "./statusChangeFlow";

/**
 * Quick status actions of the order detail "Acciones" card (admin status jump, 2026-10-14,
 * `odd/tasks/admin-status-jump.md`). Presentational: the request itself is `onChangeStatus`,
 * owned by `ProcessOrder`. This component only holds the dialog state.
 *
 *  - "Avanzar a <siguiente>": the next stage (an operator only gets the next bodega step).
 *  - "Cancelar pedido": with an optional reason, stored as `cancellation_reason`.
 *  - "Cambiar estado…" (admin, super_admin): any status but the current one. A jump the state
 *    machine would not take offers "Notificar al cliente", unchecked by default.
 *  - A 409 `OPEN_CHECKOUTS` lists the units still out and asks "Confirmar de todos modos".
 */

export interface StatusQuickActions {
  advanceTo: OrderStatus | null;
  canCancel: boolean;
  canJump: boolean;
  jumpTargets: OrderStatus[];
}

/** What the card offers for this status and role. */
export function buildStatusQuickActions(
  currentStatus: string | null | undefined,
  role: string | null | undefined,
): StatusQuickActions {
  const current = canonicalStatus(currentStatus);

  if (role === "operator") {
    const step = operatorNextStatus(current);
    return {
      advanceTo: step ? (canonicalStatus(step) ?? null) : null,
      canCancel: false,
      canJump: false,
      jumpTargets: [],
    };
  }

  const isOpen = current !== null && !isTerminalStatus(current);
  const canJump = canJumpStatus(role);
  return {
    advanceTo: current ? nextStatus(current) : null,
    canCancel: isOpen,
    canJump,
    // Only the exact stored value is excluded: a legacy row (`on-hold`) may be moved onto its
    // canonical stage (`request`), which the route accepts as a real change.
    jumpTargets: canJump
      ? ORDER_STATUSES.filter((status) => status !== currentStatus)
      : [],
  };
}

type OpenDialog = "cancel" | "jump" | null;

export function OrderStatusQuickActions({
  currentStatus,
  role,
  onChangeStatus,
  disabled = false,
}: {
  currentStatus: string | null | undefined;
  role: string | null | undefined;
  onChangeStatus: (request: StatusChangeRequest) => Promise<StatusChangeOutcome>;
  disabled?: boolean;
}) {
  const actions = buildStatusQuickActions(currentStatus, role);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [target, setTarget] = useState<OrderStatus | "">("");
  const [notify, setNotify] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openCheckouts, setOpenCheckouts] = useState<{
    request: StatusChangeRequest;
    assetTags: string[];
  } | null>(null);

  const isBusy = disabled || pending;

  function resetForm() {
    setTarget("");
    setNotify(false);
    setReason("");
    setError(null);
  }

  async function submit(request: StatusChangeRequest) {
    setPending(true);
    setError(null);
    try {
      const result = await submitStatusChange(request, onChangeStatus);
      if (result.kind === "done") {
        setDialog(null);
        setOpenCheckouts(null);
        resetForm();
        return;
      }
      if (result.kind === "confirm-open-checkouts") {
        setDialog(null);
        setOpenCheckouts({ request: result.request, assetTags: result.assetTags });
        return;
      }
      setError(result.error);
    } finally {
      setPending(false);
    }
  }

  const offerNotify = target !== "" && shouldOfferNotify(currentStatus, target);
  const asksReason = target === "cancelled";

  if (!actions.advanceTo && !actions.canCancel && !actions.canJump) return null;

  return (
    <div className="mb-2 flex flex-col gap-1.5">
      {actions.advanceTo && (
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={isBusy}
          onClick={() => submit(buildAdvanceRequest(actions.advanceTo as OrderStatus))}
        >
          {pending && !dialog ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          )}
          Avanzar a {statusLabel(actions.advanceTo)}
        </Button>
      )}

      {(actions.canCancel || actions.canJump) && (
        <div className="flex gap-1.5 [&>*]:flex-1">
          {actions.canCancel && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isBusy}
              onClick={() => {
                resetForm();
                setDialog("cancel");
              }}
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Cancelar pedido
            </Button>
          )}
          {actions.canJump && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isBusy}
              onClick={() => {
                resetForm();
                setDialog("jump");
              }}
            >
              <Repeat className="h-4 w-4" aria-hidden="true" />
              Cambiar estado…
            </Button>
          )}
        </div>
      )}

      {error && !dialog && !openCheckouts && (
        <p role="alert" className="m-0 text-[11px] text-[var(--color-crit)]">
          {error}
        </p>
      )}

      <Dialog
        open={dialog === "cancel"}
        onOpenChange={(open) => !open && !pending && setDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar pedido</DialogTitle>
            <DialogDescription>
              El pedido pasa a Cancelado y el cliente recibe el aviso de cancelación.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="status-cancel-reason">Motivo (opcional)</Label>
            <Textarea
              id="status-cancel-reason"
              value={reason}
              maxLength={STATUS_REASON_MAX_LENGTH}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ej.: el cliente cambió las fechas"
            />
          </div>
          {error && (
            <p role="alert" className="m-0 text-sm text-[var(--color-crit)]">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDialog(null)}
            >
              Volver
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => submit(buildCancelRequest(reason))}
            >
              {pending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Cancelar pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "jump"}
        onOpenChange={(open) => !open && !pending && setDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar estado</DialogTitle>
            <DialogDescription>
              Estado actual: {statusLabel(String(currentStatus ?? ""))}. Puedes mover el
              pedido a cualquier estado, también hacia atrás.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="status-jump-target">Nuevo estado</Label>
              <select
                id="status-jump-target"
                value={target}
                onChange={(event) => {
                  setTarget(event.target.value as OrderStatus | "");
                  setNotify(false);
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="" disabled>
                  Elige un estado
                </option>
                {actions.jumpTargets.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </div>

            {offerNotify && (
              <div className="flex items-start gap-2">
                <Checkbox
                  id="status-jump-notify"
                  checked={notify}
                  onCheckedChange={(checked) => setNotify(checked === true)}
                />
                <div className="space-y-0.5">
                  <Label htmlFor="status-jump-notify">Notificar al cliente</Label>
                  <p className="m-0 text-[11px] text-muted-foreground">
                    Este cambio se salta el orden normal. Si no lo marcas, el cliente no recibe
                    correo.
                  </p>
                </div>
              </div>
            )}

            {asksReason && (
              <div className="space-y-1.5">
                <Label htmlFor="status-jump-reason">Motivo (opcional)</Label>
                <Textarea
                  id="status-jump-reason"
                  value={reason}
                  maxLength={STATUS_REASON_MAX_LENGTH}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
            )}
          </div>
          {error && (
            <p role="alert" className="m-0 text-sm text-[var(--color-crit)]">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDialog(null)}
            >
              Volver
            </Button>
            <Button
              type="button"
              disabled={pending || target === ""}
              onClick={() =>
                target !== "" &&
                submit(
                  buildJumpRequest({ currentStatus, target, notify, reason }),
                )
              }
            >
              {pending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Cambiar estado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openCheckouts !== null}
        onOpenChange={(open) => !open && !pending && setOpenCheckouts(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hay equipos sin devolver</DialogTitle>
            <DialogDescription>
              Estas unidades siguen marcadas como fuera para este pedido. Si cambias el estado
              igual, quedan así hasta que registres su devolución en bodega.
            </DialogDescription>
          </DialogHeader>
          <ul className="m-0 list-disc space-y-0.5 pl-5 font-mono text-sm">
            {(openCheckouts?.assetTags ?? []).map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
          {error && (
            <p role="alert" className="m-0 text-sm text-[var(--color-crit)]">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpenCheckouts(null)}
            >
              Volver
            </Button>
            <Button
              type="button"
              disabled={pending || openCheckouts === null}
              onClick={() =>
                openCheckouts &&
                submit(acknowledgeOpenCheckouts(openCheckouts.request))
              }
            >
              {pending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Confirmar de todos modos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
