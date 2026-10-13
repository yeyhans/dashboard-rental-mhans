import React, { useMemo, useReducer, useState } from "react";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { itemsFromLineItems } from "../../lib/checkIn";
import {
  INCIDENT_NOTE_MAX_LENGTH,
  INCIDENT_TYPES,
  RECEPTION_STATE_OPTIONS,
  createReception,
  finalizeState,
  isIncidentState,
  receptionReducer,
  receptionTotals,
  returnClosingSteps,
  type LineReception,
  type ReceptionState,
} from "../../lib/checkInReception";
import { apiClient } from "../../services/apiClient";
import type { CheckInListEntry } from "../../services/checkInService";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import AssetCheckInControl from "./AssetCheckInControl";

/**
 * Detail panel of Check-In / Devoluciones: per-line reception and the close of the return (R-04).
 *
 * Canon `MarioHans_OS_Area01_CheckIn_Devoluciones_Canonical_RC2.1.2.html` (`renderEquipos`,
 * incidence row, "Marcar todos como recibidos", "Finalizar devolución" + summary modal). The
 * client asked for buttons instead of the canonical `<select>` to set each line's state.
 *
 * Every decision lives in `lib/checkInReception.ts`; this component renders it. Mounted with
 * `key={entry.id}` so switching orders starts a fresh reception.
 *
 * What persists: closing moves the order to `completed` through `PUT /api/orders/[id]/status`
 * (one legal step at a time), and a serialised unit's check-in carries the line's incident in
 * `asset_movements.condition_notes`. The per-line state itself has no column in the schema.
 */
interface CheckInReceptionPanelProps {
  entry: CheckInListEntry;
}

const STATE_LABEL: Record<ReceptionState, string> = Object.fromEntries(
  RECEPTION_STATE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<ReceptionState, string>;

/** Pressed-button colours: functional state only (rules/04). */
const PRESSED_TONE: Record<ReceptionState, string> = {
  received:
    "border-[var(--color-ok)] bg-[var(--color-ok-bg)] text-[var(--color-ok)]",
  incomplete:
    "border-[var(--color-warn)] bg-[var(--color-warn-bg)] text-[var(--color-warn)]",
  damaged:
    "border-[var(--color-crit)] bg-[var(--color-crit-bg)] text-[var(--color-crit)]",
  "not-delivered":
    "border-[var(--color-crit)] bg-[var(--color-crit-bg)] text-[var(--color-crit)]",
  pending:
    "border-[var(--color-text-primary)] bg-[var(--color-surface-2)] text-[var(--color-text-primary)]",
};

const ITEM_FILTERS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "received", label: "Recibidos" },
  { value: "incidencias", label: "Incidencias" },
];

/** "Dañado · Falla eléctrica · no enciende" — stored with a serialised unit's check-in. */
function incidentSummary(line: LineReception | undefined): string {
  if (!line || !isIncidentState(line.state)) return "";
  return [STATE_LABEL[line.state], line.incidentType, line.note.trim()]
    .filter(Boolean)
    .join(" · ");
}

export default function CheckInReceptionPanel({
  entry,
}: CheckInReceptionPanelProps) {
  const items = useMemo(
    () => itemsFromLineItems(entry.lineItems),
    [entry.lineItems],
  );
  const lines = useMemo(
    () =>
      items.map((item, index) => ({
        key: String(index),
        quantity: item.quantity,
      })),
    [items],
  );
  const [reception, dispatch] = useReducer(
    receptionReducer,
    lines,
    createReception,
  );
  const [itemFilter, setItemFilter] = useState("todos");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const totals = receptionTotals(lines, reception);
  const finalize = finalizeState(lines, reception);
  const closingSteps = returnClosingSteps(entry.status);
  const canFinalize = finalize.enabled && closingSteps !== null && !closing;
  const finalizeHint =
    closingSteps === null
      ? "Solo se puede cerrar un pedido en arriendo o en devolución."
      : finalize.reason;

  const visibleIndexes = items
    .map((_, index) => index)
    .filter((index) => {
      const state = reception[String(index)]?.state ?? "pending";
      if (itemFilter === "todos") return true;
      if (itemFilter === "incidencias") return isIncidentState(state);
      return state === itemFilter;
    });

  const incidents = items
    .map((item, index) => ({ item, line: reception[String(index)] }))
    .filter(({ line }) => line && isIncidentState(line.state));

  const handleConfirmClose = async () => {
    if (!closingSteps) return;
    setClosing(true);
    try {
      // One legal step at a time: an order that came back before the hourly cron moved it to
      // `return` goes in-rental -> return -> completed, each through the state machine.
      for (const status of closingSteps) {
        const response = await apiClient.put(`/api/orders/${entry.id}/status`, {
          status,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          toast.error(
            payload?.error ||
              "No se pudo cerrar la devolución. Inténtalo de nuevo.",
          );
          return;
        }
      }
      toast.success(
        finalize.variant === "incident"
          ? "Devolución cerrada con incidencias"
          : "Devolución cerrada",
      );
      setConfirmOpen(false);
      window.location.reload();
    } catch {
      toast.error("Error de conexión al cerrar la devolución");
    } finally {
      setClosing(false);
    }
  };

  const counters = [
    { label: "Total", value: totals.total, tone: "" },
    {
      label: "Recibidos",
      value: totals.recibidos,
      tone: "text-[var(--color-ok)]",
    },
    {
      label: "Incompletos",
      value: totals.incompletos,
      tone: "text-[var(--color-warn)]",
    },
    {
      label: "Dañados / NE",
      value: totals.danados,
      tone: "text-[var(--color-crit)]",
    },
    {
      label: "Pendientes",
      value: totals.pendientes,
      tone: "text-[var(--color-text-secondary)]",
    },
  ];

  return (
    <div>
      <div className="border-b border-[var(--color-border)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[11px] text-[var(--color-text-secondary)]">
              {entry.reference}
            </div>
            <h2 className="truncate text-sm font-semibold">{entry.client}</h2>
            <p className="truncate text-xs text-[var(--color-text-secondary)]">
              Proyecto: {entry.project}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Término del arriendo: {entry.endDate ?? "sin fecha"}
            </p>
          </div>
          <a
            href={`/orders/${entry.id}`}
            className="whitespace-nowrap text-xs text-[var(--color-text-primary)] underline underline-offset-2"
          >
            Ver pedido →
          </a>
        </div>

        <div className="mt-4 grid grid-cols-5 gap-2">
          {counters.map((metric) => (
            <div
              key={metric.label}
              className="rounded-[6px] bg-[var(--color-surface-2)] p-2 text-center"
            >
              {/* D-22 (03d): `var(--font-mono)` is the design-system figure font, not `font-mono`. */}
              <div
                className={`text-base font-semibold ${metric.tone}`}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {metric.value}
              </div>
              <div className="text-[10px] text-[var(--color-text-faint)]">
                {metric.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--color-border)] px-4 py-2">
        {ITEM_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setItemFilter(filter.value)}
            className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
              itemFilter === filter.value
                ? "bg-[var(--color-text-primary)] text-white"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
            }`}
          >
            {filter.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => dispatch({ type: "markAllReceived" })}
          disabled={totals.pendientes === 0}
          title="Marcar todos los pendientes como Recibido"
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[11px] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] disabled:opacity-50"
        >
          <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Marcar todos como recibidos
        </button>
      </div>

      <ul className="lg:max-h-[300px] lg:overflow-y-auto">
        {visibleIndexes.length === 0 && (
          <li className="p-6 text-center text-xs text-[var(--color-text-secondary)]">
            Este pedido no tiene equipos en esa categoría.
          </li>
        )}
        {visibleIndexes.map((index) => {
          const item = items[index]!;
          const key = String(index);
          const line = reception[key];
          const current = line?.state ?? "pending";
          return (
            <li
              key={`${item.sku}-${index}`}
              className="border-b border-[var(--color-border-soft)] px-4 py-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">
                    {item.name}
                  </div>
                  <div className="font-mono text-[10px] text-[var(--color-text-faint)]">
                    {item.sku}
                  </div>
                </div>
                <span className="whitespace-nowrap font-mono text-xs text-[var(--color-text-secondary)]">
                  ×{item.quantity}
                </span>
              </div>

              <div
                role="group"
                aria-label={`Estado de recepción — ${item.name}`}
                className="mt-1.5 flex flex-wrap gap-1"
              >
                {RECEPTION_STATE_OPTIONS.map((option) => {
                  const pressed = option.value === current;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={pressed ? "true" : "false"}
                      onClick={() =>
                        dispatch({ type: "setState", key, state: option.value })
                      }
                      className={`rounded-[6px] border px-2 py-0.5 text-[11px] transition-colors ${
                        pressed
                          ? PRESSED_TONE[option.value]
                          : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              {line && isIncidentState(line.state) && (
                <div className="mt-2 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2">
                  <p className="text-[11px] font-medium text-[var(--color-text-primary)]">
                    Marcado como {STATE_LABEL[line.state].toLowerCase()} ·
                    Registrar incidencia
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <select
                      value={line.incidentType}
                      onChange={(e) =>
                        dispatch({
                          type: "setIncident",
                          key,
                          incidentType: e.target.value,
                          note: line.note,
                        })
                      }
                      aria-label={`Tipo de incidencia — ${item.name}`}
                      className="rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-[11px]"
                    >
                      <option value="">— Tipo de incidencia…</option>
                      {INCIDENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={line.note}
                      maxLength={INCIDENT_NOTE_MAX_LENGTH}
                      onChange={(e) =>
                        dispatch({
                          type: "setIncident",
                          key,
                          incidentType: line.incidentType,
                          note: e.target.value,
                        })
                      }
                      placeholder="Nota (opcional)"
                      aria-label={`Nota de incidencia — ${item.name}`}
                      className="min-w-[10rem] flex-1 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-[11px]"
                    />
                  </div>
                </div>
              )}

              {item.productId !== null && (
                <AssetCheckInControl
                  productId={item.productId}
                  orderId={entry.id}
                  incidentNote={incidentSummary(line)}
                />
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-end gap-3 p-4">
        {finalizeHint && (
          <p className="mr-auto text-[11px] text-[var(--color-text-secondary)]">
            {finalizeHint}
          </p>
        )}
        <button
          type="button"
          disabled={!canFinalize}
          onClick={() => setConfirmOpen(true)}
          className={`rounded-[6px] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 ${
            finalize.variant === "incident"
              ? "bg-[var(--color-crit)]"
              : "bg-[var(--color-text-primary)]"
          }`}
        >
          {finalize.label}
        </button>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => !closing && setConfirmOpen(open)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar devolución</DialogTitle>
            <DialogDescription>Resumen antes de cerrar</DialogDescription>
          </DialogHeader>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt>Recibidos</dt>
              <dd className="font-medium">{totals.recibidos}</dd>
            </div>
            {totals.incompletos > 0 && (
              <div className="flex justify-between">
                <dt>Incompletos</dt>
                <dd className="font-medium text-[var(--color-warn)]">
                  {totals.incompletos}
                </dd>
              </div>
            )}
            {totals.danados > 0 && (
              <div className="flex justify-between">
                <dt>Dañados / No entregados</dt>
                <dd className="font-medium text-[var(--color-crit)]">
                  {totals.danados}
                </dd>
              </div>
            )}
          </dl>
          {incidents.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium">Incidencias</p>
              <ul className="space-y-1 text-xs text-[var(--color-text-secondary)]">
                {incidents.map(({ item, line }, index) => (
                  <li key={`${item.sku}-${index}`}>
                    {item.name}: {incidentSummary(line)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-[var(--color-text-secondary)]">
            El pedido pasará a Completado.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={closing}
              onClick={() => setConfirmOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant={
                finalize.variant === "incident" ? "destructive" : "default"
              }
              disabled={closing}
              onClick={handleConfirmClose}
            >
              {closing ? "Cerrando…" : "Confirmar cierre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
