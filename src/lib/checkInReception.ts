/**
 * Per-line reception for Check-In / Devoluciones (R-04).
 *
 * Source: `Área 01 · Rental Técnico/OFF/MarioHans_OS_Area01_CheckIn_Devoluciones_Canonical_RC2.1.2.html`
 * (`renderEquipos`, `needsIncRow`, `buildIncRow`, `updateFinalizarBtn`). The client asked for
 * buttons instead of the canonical `<select>`, so the states are the same and only the control
 * changes.
 *
 * Pure: the component renders this state, and the arithmetic stays testable without a DOM.
 *
 * Persistence: there is no per-line reception column in the schema. This state lives in the
 * session until the return is finalized; what is persisted is the order's status change and,
 * per serialised unit, the check-in movement (`asset_movements.condition_notes`).
 */

export type ReceptionState =
  | "pending"
  | "received"
  | "incomplete"
  | "damaged"
  | "not-delivered";

/** Button order and labels, as the client named them. */
export const RECEPTION_STATE_OPTIONS: readonly {
  value: ReceptionState;
  label: string;
}[] = [
  { value: "received", label: "Recibido" },
  { value: "incomplete", label: "Incompleto" },
  { value: "damaged", label: "Dañado" },
  { value: "not-delivered", label: "No entregado" },
  { value: "pending", label: "Pendiente" },
];

/** The canonical `inc-select` options, verbatim. */
export const INCIDENT_TYPES = [
  "Daño físico visible",
  "Pieza o accesorio faltante",
  "Daño por humedad",
  "Falla eléctrica",
  "Rayón o desgaste estético",
  "No devuelto",
  "Otro",
] as const;

export const INCIDENT_NOTE_MAX_LENGTH = 500;

export interface LineReception {
  state: ReceptionState;
  incidentType: string;
  note: string;
}

export type ReceptionMap = Record<string, LineReception>;

/** What the reducer needs to know about a line: a stable key and its unit count. */
export interface ReceptionLine {
  key: string;
  quantity: number;
}

export type ReceptionAction =
  | { type: "setState"; key: string; state: ReceptionState }
  | { type: "setIncident"; key: string; incidentType: string; note: string }
  | { type: "markAllReceived" };

const EMPTY_INCIDENT = { incidentType: "", note: "" };

export function createReception(lines: readonly ReceptionLine[]): ReceptionMap {
  const map: ReceptionMap = {};
  for (const line of lines) {
    map[line.key] = { state: "pending", ...EMPTY_INCIDENT };
  }
  return map;
}

export function isIncidentState(state: ReceptionState): boolean {
  return (
    state === "incomplete" || state === "damaged" || state === "not-delivered"
  );
}

/** A non-OK line without an incident type still needs the inline incident row filled in. */
export function needsIncident(line: LineReception): boolean {
  return isIncidentState(line.state) && line.incidentType.trim() === "";
}

export function receptionReducer(
  state: ReceptionMap,
  action: ReceptionAction,
): ReceptionMap {
  switch (action.type) {
    case "setState": {
      const current = state[action.key];
      if (!current) return state;
      // Going back to OK (or resetting) drops the incident: it described a problem that no
      // longer stands, and keeping it would count as an incident at finalize time.
      const next: LineReception = isIncidentState(action.state)
        ? { ...current, state: action.state }
        : { state: action.state, ...EMPTY_INCIDENT };
      return { ...state, [action.key]: next };
    }
    case "setIncident": {
      const current = state[action.key];
      if (!current || !isIncidentState(current.state)) return state;
      return {
        ...state,
        [action.key]: {
          ...current,
          incidentType: action.incidentType,
          note: action.note.slice(0, INCIDENT_NOTE_MAX_LENGTH),
        },
      };
    }
    case "markAllReceived": {
      // Canon: "Marcar todos los pendientes como Recibido" — lines already judged keep their state.
      const next: ReceptionMap = {};
      for (const [key, line] of Object.entries(state)) {
        next[key] =
          line.state === "pending"
            ? { state: "received", ...EMPTY_INCIDENT }
            : line;
      }
      return next;
    }
    default:
      return state;
  }
}

/** The five canonical counters plus the number of lines with an incident. Counts units. */
export interface ReceptionTotals {
  total: number;
  recibidos: number;
  incompletos: number;
  /** Canon "Dañados / NE": damaged and not delivered share one counter. */
  danados: number;
  pendientes: number;
  incidencias: number;
}

export function receptionTotals(
  lines: readonly ReceptionLine[],
  state: ReceptionMap,
): ReceptionTotals {
  const totals: ReceptionTotals = {
    total: 0,
    recibidos: 0,
    incompletos: 0,
    danados: 0,
    pendientes: 0,
    incidencias: 0,
  };
  for (const line of lines) {
    const units = Math.max(0, line.quantity);
    const reception = state[line.key]?.state ?? "pending";
    totals.total += units;
    if (reception === "received") totals.recibidos += units;
    else if (reception === "incomplete") totals.incompletos += units;
    else if (reception === "damaged" || reception === "not-delivered")
      totals.danados += units;
    else totals.pendientes += units;
    if (isIncidentState(reception)) totals.incidencias += 1;
  }
  return totals;
}

export interface FinalizeState {
  enabled: boolean;
  variant: "ok" | "incident";
  label: "Finalizar devolución" | "Finalizar con incidencia";
  /** Why the button is disabled, for its hint; `null` when enabled. */
  reason: string | null;
}

export function finalizeState(
  lines: readonly ReceptionLine[],
  state: ReceptionMap,
): FinalizeState {
  const totals = receptionTotals(lines, state);
  if (totals.total === 0) {
    return {
      enabled: false,
      variant: "ok",
      label: "Finalizar devolución",
      reason: "El pedido no tiene equipos que recibir.",
    };
  }
  if (totals.pendientes > 0) {
    return {
      enabled: false,
      variant: "ok",
      label: "Finalizar devolución",
      reason: "Marca el estado de todos los equipos antes de finalizar.",
    };
  }

  const hasIncident = totals.incidencias > 0;
  const untyped = lines.some((line) => {
    const reception = state[line.key];
    return reception ? needsIncident(reception) : false;
  });
  return {
    enabled: !untyped,
    variant: hasIncident ? "incident" : "ok",
    label: hasIncident ? "Finalizar con incidencia" : "Finalizar devolución",
    reason: untyped
      ? "Elige el tipo de incidencia de cada equipo con problema."
      : null,
  };
}

/**
 * The status steps that close a return, through the state machine (one stage at a time). An order
 * that came back before the hourly cron moved it to `return` is walked through `return` first.
 */
export function returnClosingSteps(
  status: string,
): ("return" | "completed")[] | null {
  if (status === "return") return ["completed"];
  if (status === "in-rental") return ["return", "completed"];
  return null;
}
