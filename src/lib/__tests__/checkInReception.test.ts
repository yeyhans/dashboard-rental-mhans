import { describe, expect, it } from "vitest";
import {
  INCIDENT_TYPES,
  createReception,
  finalizeState,
  needsIncident,
  receptionReducer,
  receptionTotals,
  returnClosingSteps,
  type ReceptionLine,
} from "../checkInReception";

/**
 * R-04: per-line reception on Check-In / Devoluciones. Each line takes a state from a row of
 * buttons (Recibido / Incompleto / Dañado / No entregado, and Pendiente to reset). A non-OK state
 * asks for an incident type and an optional note. "Finalizar devolución" is enabled once nothing
 * is pending and every incident is typed; with incidents it turns into "Finalizar con incidencia".
 */
const LINES: ReceptionLine[] = [
  { key: "0", quantity: 2 },
  { key: "1", quantity: 1 },
  { key: "2", quantity: 3 },
];

describe("receptionReducer", () => {
  it("starts every line pending", () => {
    const state = createReception(LINES);
    expect(Object.values(state).map((l) => l.state)).toEqual([
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("sets a line state", () => {
    const state = receptionReducer(createReception(LINES), {
      type: "setState",
      key: "1",
      state: "damaged",
    });
    expect(state["1"]!.state).toBe("damaged");
  });

  it("clears the incident when a line goes back to received or pending", () => {
    let state = receptionReducer(createReception(LINES), {
      type: "setState",
      key: "0",
      state: "incomplete",
    });
    state = receptionReducer(state, {
      type: "setIncident",
      key: "0",
      incidentType: INCIDENT_TYPES[1],
      note: "Falta el cargador",
    });
    state = receptionReducer(state, {
      type: "setState",
      key: "0",
      state: "received",
    });
    expect(state["0"]).toEqual({
      state: "received",
      incidentType: "",
      note: "",
    });
  });

  it("marks only the pending lines as received", () => {
    let state = receptionReducer(createReception(LINES), {
      type: "setState",
      key: "2",
      state: "damaged",
    });
    state = receptionReducer(state, { type: "markAllReceived" });
    expect(state["0"]!.state).toBe("received");
    expect(state["1"]!.state).toBe("received");
    expect(state["2"]!.state).toBe("damaged");
  });

  it("ignores an unknown line key", () => {
    const initial = createReception(LINES);
    expect(
      receptionReducer(initial, {
        type: "setState",
        key: "99",
        state: "received",
      }),
    ).toBe(initial);
  });
});

describe("receptionTotals", () => {
  it("counts units, and folds not-delivered into the damaged counter", () => {
    let state = createReception(LINES);
    state = receptionReducer(state, {
      type: "setState",
      key: "0",
      state: "received",
    });
    state = receptionReducer(state, {
      type: "setState",
      key: "1",
      state: "not-delivered",
    });
    state = receptionReducer(state, {
      type: "setState",
      key: "2",
      state: "incomplete",
    });

    expect(receptionTotals(LINES, state)).toEqual({
      total: 6,
      recibidos: 2,
      incompletos: 3,
      danados: 1,
      pendientes: 0,
      incidencias: 2,
    });
  });
});

describe("finalizeState", () => {
  it("is disabled while any line is pending", () => {
    const state = receptionReducer(createReception(LINES), {
      type: "setState",
      key: "0",
      state: "received",
    });
    expect(finalizeState(LINES, state)).toEqual(
      expect.objectContaining({
        enabled: false,
        variant: "ok",
        label: "Finalizar devolución",
      }),
    );
  });

  it("is enabled and plain when everything came back", () => {
    const state = receptionReducer(createReception(LINES), {
      type: "markAllReceived",
    });
    expect(finalizeState(LINES, state)).toEqual({
      enabled: true,
      variant: "ok",
      label: "Finalizar devolución",
      reason: null,
    });
  });

  it("requires every incident to have a type", () => {
    let state = receptionReducer(createReception(LINES), {
      type: "markAllReceived",
    });
    state = receptionReducer(state, {
      type: "setState",
      key: "1",
      state: "damaged",
    });
    expect(needsIncident(state["1"]!)).toBe(true);

    const blocked = finalizeState(LINES, state);
    expect(blocked.enabled).toBe(false);
    expect(blocked.reason).toContain("tipo de incidencia");

    state = receptionReducer(state, {
      type: "setIncident",
      key: "1",
      incidentType: INCIDENT_TYPES[0],
      note: "",
    });
    expect(needsIncident(state["1"]!)).toBe(false);
    expect(finalizeState(LINES, state)).toEqual({
      enabled: true,
      variant: "incident",
      label: "Finalizar con incidencia",
      reason: null,
    });
  });
});

describe("returnClosingSteps", () => {
  it("closes a return order in one step", () => {
    expect(returnClosingSteps("return")).toEqual(["completed"]);
  });

  it("walks an in-rental order through return first", () => {
    expect(returnClosingSteps("in-rental")).toEqual(["return", "completed"]);
  });

  it("refuses any other stage", () => {
    expect(returnClosingSteps("preparation")).toBeNull();
    expect(returnClosingSteps("completed")).toBeNull();
  });
});
