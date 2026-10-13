import React, { useEffect, useMemo, useReducer, useState } from "react";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { itemsFromLineItems } from "../../lib/checkIn";
import {
  INCIDENT_NOTE_MAX_LENGTH,
  INCIDENT_TYPES,
  RECEPTION_STATE_OPTIONS,
  buildReturnReportLines,
  createReception,
  finalizeState,
  isIncidentState,
  isReturnDue,
  linesToAutoReceive,
  receptionReducer,
  receptionTotals,
  returnClosingSteps,
  type LineReception,
  type ReceptionLine,
  type ReceptionMap,
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
 * R-04b: the same panel serves /check-in (admins, desktop) and the operator's order screen on
 * /bodega (`variant="mobile"`: big tap targets that wrap). A serialised check-in — from the
 * line's own control or from the bodega gun scanner, via `checkedInUnits` — marks the line
 * Recibido once every unit of it is back (`linesToAutoReceive`).
 *
 * What persists: "Finalizar devolución" posts the report to `POST /api/bodega/orders/[id]/finalize`
 * (operator-reachable), which walks the order to `completed` one legal step at a time and saves
 * `orders.return_report`; a serialised unit's check-in also carries the line's incident in
 * `asset_movements.condition_notes`.
 */
type PanelEntry = Pick<
  CheckInListEntry,
  "id" | "reference" | "client" | "project" | "status" | "endDate" | "lineItems"
>;

interface CheckInReceptionPanelProps {
  entry: PanelEntry;
  /** `"mobile"` on /bodega: larger buttons, no order header (the scan screen shows it). */
  variant?: "desktop" | "mobile";
  /** Server-resolved business day; decides whether an `in-rental` order may be closed yet. */
  todayIsoDay?: string;
  /** Units checked in per product id, from outside the panel (the bodega scanner). */
  checkedInUnits?: Readonly<Record<number, number>>;
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

/** Applies `linesToAutoReceive` to a reception map. */
function autoReceive(
  state: ReceptionMap,
  lines: readonly (ReceptionLine & { productId: number | null })[],
  checkedIn: Readonly<Record<number, number>>,
): ReceptionMap {
  return linesToAutoReceive(lines, state, checkedIn).reduce(
    (next, key) =>
      receptionReducer(next, { type: "setState", key, state: "received" }),
    state,
  );
}

export default function CheckInReceptionPanel({
  entry,
  variant = "desktop",
  todayIsoDay,
  checkedInUnits,
}: CheckInReceptionPanelProps) {
  const isMobile = variant === "mobile";
  const items = useMemo(
    () => itemsFromLineItems(entry.lineItems),
    [entry.lineItems],
  );
  const lines = useMemo(
    () =>
      items.map((item, index) => ({
        key: String(index),
        quantity: item.quantity,
        productId: item.productId,
      })),
    [items],
  );
  // Units checked in from this panel's own controls, added to the ones the parent reports.
  const [localCheckIns, setLocalCheckIns] = useState<Record<number, number>>(
    {},
  );
  const checkedIn = useMemo(() => {
    const merged: Record<number, number> = { ...(checkedInUnits ?? {}) };
    for (const [productId, units] of Object.entries(localCheckIns)) {
      merged[Number(productId)] = (merged[Number(productId)] ?? 0) + units;
    }
    return merged;
  }, [checkedInUnits, localCheckIns]);

  const [reception, dispatch] = useReducer(receptionReducer, lines, (initial) =>
    autoReceive(createReception(initial), initial, checkedInUnits ?? {}),
  );

  useEffect(() => {
    for (const key of linesToAutoReceive(lines, reception, checkedIn)) {
      dispatch({ type: "setState", key, state: "received" });
    }
    // `reception` is read, not watched: a line set by hand must not be re-marked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedIn, lines]);

  const [itemFilter, setItemFilter] = useState("todos");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  const totals = receptionTotals(lines, reception);
  const finalize = finalizeState(lines, reception);
  const closingSteps = returnClosingSteps(entry.status);
  const notDueYet =
    entry.status === "in-rental" &&
    todayIsoDay !== undefined &&
    !isReturnDue(entry.endDate, todayIsoDay);
  const canFinalize =
    finalize.enabled && closingSteps !== null && !notDueYet && !closing;
  const finalizeHint =
    closingSteps === null
      ? "Solo se puede cerrar un pedido en arriendo o en devolución."
      : notDueYet
        ? "El arriendo aún no termina: la devolución se cierra desde la fecha de término."
        : finalize.reason;

  const handleUnitCheckedIn = (productId: number) =>
    setLocalCheckIns((prev) => ({
      ...prev,
      [productId]: (prev[productId] ?? 0) + 1,
    }));

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
      // The server walks the order to `completed` one legal step at a time (in-rental -> return
      // -> completed when the rental already ended) and saves the report with it.
      const response = await apiClient.post(
        `/api/bodega/orders/${entry.id}/finalize`,
        {
          lines: buildReturnReportLines(
            items.map((item) => item.name),
            lines,
            reception,
          ),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        const message =
          payload?.error ||
          "No se pudo cerrar la devolución. Inténtalo de nuevo.";
        // H-2: a close that stopped midway stays visible in the dialog, with where the order
        // was left; "Reintentar cierre" resumes from there (the server derives the steps).
        if (payload?.code === "PARTIAL_CLOSE") {
          setCloseError(message);
          return;
        }
        toast.error(message);
        return;
      }
      setCloseError(null);
      if (payload.warning) toast.warning(payload.warning);
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
        {/* On /bodega the scan screen already shows the order header above the panel. */}
        {!isMobile && (
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
        )}

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
          className={`ml-auto inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] disabled:opacity-50 ${
            isMobile ? "min-h-11 px-4 text-sm" : "px-2.5 py-1 text-[11px]"
          }`}
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
                className={`mt-1.5 flex flex-wrap ${isMobile ? "gap-2" : "gap-1"}`}
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
                      className={`rounded-[6px] border transition-colors ${
                        isMobile
                          ? "min-h-11 px-3 py-2 text-sm"
                          : "px-2 py-0.5 text-[11px]"
                      } ${
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
                  onCheckedIn={() => handleUnitCheckedIn(item.productId!)}
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
          className={`rounded-[6px] font-medium text-white disabled:opacity-50 ${
            isMobile ? "min-h-12 w-full px-4 text-sm" : "px-3 py-1.5 text-xs"
          } ${
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
          {closeError && (
            <p
              role="alert"
              className="rounded-[6px] border border-[var(--color-crit)] bg-[var(--color-crit-bg)] p-2 text-xs text-[var(--color-crit)]"
            >
              {closeError}
            </p>
          )}
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
              {closing
                ? "Cerrando…"
                : closeError
                  ? "Reintentar cierre"
                  : "Confirmar cierre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
