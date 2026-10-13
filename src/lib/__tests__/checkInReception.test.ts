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

/* R-04b ------------------------------------------------------------------------------------- */

import {
  RETURN_REPORT_ERRORS,
  buildReturnReportLines,
  isReturnDue,
  linesToAutoReceive,
  parseReturnReportLines,
} from "../checkInReception";

describe("isReturnDue", () => {
  it("is due once the rental end date is today or past", () => {
    expect(isReturnDue("2026-10-13", "2026-10-13")).toBe(true);
    expect(isReturnDue("2026-10-10", "2026-10-13")).toBe(true);
  });

  it("is not due before the end date or without one", () => {
    expect(isReturnDue("2026-10-14", "2026-10-13")).toBe(false);
    expect(isReturnDue(null, "2026-10-13")).toBe(false);
  });
});

describe("linesToAutoReceive", () => {
  const lines = [
    { key: "0", quantity: 2, productId: 10 },
    { key: "1", quantity: 1, productId: 11 },
    { key: "2", quantity: 1, productId: null },
  ];

  it("marks a pending line once every unit of it was checked in", () => {
    const state = createReception(lines);
    expect(linesToAutoReceive(lines, state, { 10: 2, 11: 0 })).toEqual(["0"]);
  });

  it("leaves a partially returned line pending", () => {
    const state = createReception(lines);
    expect(linesToAutoReceive(lines, state, { 10: 1 })).toEqual([]);
  });

  it("never overrides a state someone already set", () => {
    const state = receptionReducer(createReception(lines), {
      type: "setState",
      key: "0",
      state: "damaged",
    });
    expect(linesToAutoReceive(lines, state, { 10: 2 })).toEqual([]);
  });
});

describe("return report lines", () => {
  const lines = [
    { key: "0", quantity: 1 },
    { key: "1", quantity: 1 },
  ];

  it("builds the payload from the reception state", () => {
    let state = receptionReducer(createReception(lines), {
      type: "markAllReceived",
    });
    state = receptionReducer(state, {
      type: "setState",
      key: "1",
      state: "damaged",
    });
    state = receptionReducer(state, {
      type: "setIncident",
      key: "1",
      incidentType: "Falla eléctrica",
      note: "no enciende",
    });

    expect(buildReturnReportLines(["Cámara", "Flash"], lines, state)).toEqual([
      {
        key: "0",
        label: "Cámara",
        state: "received",
        incident_type: null,
        note: null,
      },
      {
        key: "1",
        label: "Flash",
        state: "damaged",
        incident_type: "Falla eléctrica",
        note: "no enciende",
      },
    ]);
  });

  it("accepts a valid payload on the server", () => {
    const result = parseReturnReportLines([
      {
        key: "0",
        label: "Cámara",
        state: "received",
        incident_type: null,
        note: null,
      },
      {
        key: "1",
        label: "Flash",
        state: "not-delivered",
        incident_type: "No devuelto",
        note: "",
      },
    ]);
    expect(result).toEqual({
      ok: true,
      lines: [
        {
          key: "0",
          label: "Cámara",
          state: "received",
          incident_type: null,
          note: null,
        },
        {
          key: "1",
          label: "Flash",
          state: "not-delivered",
          incident_type: "No devuelto",
          note: null,
        },
      ],
    });
  });

  it.each([
    ["not an array", { lines: [] }],
    ["empty", []],
    ["a pending line", [{ key: "0", label: "x", state: "pending" }]],
    ["an unknown state", [{ key: "0", label: "x", state: "lost" }]],
    ["an incident without type", [{ key: "0", label: "x", state: "damaged" }]],
    [
      "an unknown incident type",
      [{ key: "0", label: "x", state: "damaged", incident_type: "Robado" }],
    ],
    [
      "a note too long",
      [
        {
          key: "0",
          label: "x",
          state: "damaged",
          incident_type: "Otro",
          note: "n".repeat(501),
        },
      ],
    ],
    ["a missing label", [{ key: "0", state: "received" }]],
  ])("rejects %s", (_name, raw) => {
    const result = parseReturnReportLines(raw);
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toBe(RETURN_REPORT_ERRORS.INVALID);
  });
});

/* H-2 --------------------------------------------------------------------------------------- */

describe("linesToAutoReceive — two lines of the same product (H-2)", () => {
  const lines = [
    { key: "0", quantity: 2, productId: 10 },
    { key: "1", quantity: 1, productId: 10 },
  ];

  it("fills the lines in order with the units checked in", () => {
    const state = createReception(lines);
    expect(linesToAutoReceive(lines, state, { 10: 2 })).toEqual(["0"]);
    expect(linesToAutoReceive(lines, state, { 10: 3 })).toEqual(["0", "1"]);
  });

  it("does not count the same units twice for both lines", () => {
    const state = createReception(lines);
    expect(linesToAutoReceive(lines, state, { 10: 1 })).toEqual([]);
  });

  it("lets a line already set by hand consume its units", () => {
    const state = receptionReducer(createReception(lines), {
      type: "setState",
      key: "0",
      state: "incomplete",
    });
    expect(linesToAutoReceive(lines, state, { 10: 2 })).toEqual([]);
    expect(linesToAutoReceive(lines, state, { 10: 3 })).toEqual(["1"]);
  });
});

describe("isReturnDue — timestamps (H-2)", () => {
  it("reads a timestamp end date in the business zone, not UTC", () => {
    // 02:00 UTC on Oct 14 is still Oct 13 in Santiago.
    expect(isReturnDue("2026-10-14T02:00:00Z", "2026-10-13")).toBe(true);
    expect(isReturnDue("2026-10-14T05:00:00Z", "2026-10-13")).toBe(false);
  });
});
