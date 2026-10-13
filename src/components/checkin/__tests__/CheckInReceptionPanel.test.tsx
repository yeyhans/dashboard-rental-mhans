import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

// Same reason as CheckInBoard.test.tsx: apiClient pulls lib/supabase, which throws at import time
// outside the browser without service-role env vars.
vi.mock("../../../services/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    handleJsonResponse: vi.fn(),
  },
}));

import CheckInReceptionPanel from "../CheckInReceptionPanel";
import type { CheckInListEntry } from "../../../services/checkInService";

const source = readFileSync(
  fileURLToPath(new URL("../CheckInReceptionPanel.tsx", import.meta.url)),
  "utf8",
);

const ENTRY: CheckInListEntry = {
  id: 7,
  reference: "PED-7",
  client: "Ana Pérez",
  project: "Rodaje",
  status: "return",
  endDate: "2026-10-12",
  urgency: "late",
  itemCount: 3,
  lineItems: [
    { name: "Cámara X", sku: "CAM-1", product_id: 10, quantity: 2 },
    { name: "Trípode", sku: "TRI-1", product_id: 11, quantity: 1 },
  ] as any,
};

/**
 * R-04: the client asked for buttons, not a select, to set each line's reception state.
 * `renderToStaticMarkup` renders the initial state (every line pending), which is what these
 * assertions cover; the transitions themselves are covered by `lib/checkInReception` tests.
 */
describe("CheckInReceptionPanel", () => {
  const html = renderToStaticMarkup(<CheckInReceptionPanel entry={ENTRY} />);

  it("renders one group of state buttons per line, in the client's order", () => {
    for (const label of [
      "Recibido",
      "Incompleto",
      "Dañado",
      "No entregado",
      "Pendiente",
    ]) {
      expect(html.split(`>${label}</button>`).length - 1).toBe(2);
    }
    expect(html).toMatch(
      /role="group"[^>]*aria-label="Estado de recepción — Cámara X"/,
    );
  });

  it("marks the current state with aria-pressed", () => {
    expect(html).toMatch(/aria-pressed="true"[^>]*>Pendiente<\/button>/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Recibido<\/button>/);
  });

  it("does not use a select for the reception state", () => {
    expect(source).not.toMatch(/<select[^>]*aria-label=\{`Estado de recepción/);
  });

  it("offers the bulk action and a disabled finalize while lines are pending", () => {
    expect(html).toContain("Marcar todos como recibidos");
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*>Finalizar devolución<\/button>/,
    );
    expect(html).toContain(
      "Marca el estado de todos los equipos antes de finalizar.",
    );
  });

  it("closes the return through the status route, one legal step at a time", () => {
    expect(source).toContain("returnClosingSteps(entry.status)");
    expect(source).toMatch(/\/api\/orders\/\$\{entry\.id\}\/status/);
  });

  it("asks for confirmation with a summary before closing", () => {
    expect(source).toContain("Confirmar cierre");
    expect(source).toContain("Resumen antes de cerrar");
  });

  it("keeps the five canonical counters", () => {
    for (const label of [
      "Total",
      "Recibidos",
      "Incompletos",
      "Dañados / NE",
      "Pendientes",
    ]) {
      expect(html).toContain(label);
    }
  });
});
