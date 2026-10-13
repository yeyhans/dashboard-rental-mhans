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

import CheckInReceptionPanel, {
  FinalizeConfirmActions,
} from "../CheckInReceptionPanel";
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

  it("closes the return through the shared finalize route with the report (R-04b)", () => {
    expect(source).toMatch(/\/api\/bodega\/orders\/\$\{entry\.id\}\/finalize/);
    expect(source).toContain("buildReturnReportLines(");
    expect(source).not.toMatch(/\/api\/orders\/\$\{entry\.id\}\/status/);
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

/** R-04b: the same panel serves /bodega (mobile) and /check-in. */
describe("CheckInReceptionPanel — shared flow (R-04b)", () => {
  it("does not let an in-rental order close before its rental ends", () => {
    const html = renderToStaticMarkup(
      <CheckInReceptionPanel
        entry={{ ...ENTRY, status: "in-rental", endDate: "2026-10-20" }}
        todayIsoDay="2026-10-13"
      />,
    );
    expect(html).toContain("El arriendo aún no termina");
  });

  it("marks a line Recibido when all its serialised units were checked in", () => {
    const html = renderToStaticMarkup(
      <CheckInReceptionPanel entry={ENTRY} checkedInUnits={{ 10: 2 }} />,
    );
    const camara = html.slice(
      html.indexOf('aria-label="Estado de recepción — Cámara X"'),
      html.indexOf('aria-label="Estado de recepción — Trípode"'),
    );
    expect(camara).toMatch(/aria-pressed="true"[^>]*>Recibido<\/button>/);
  });

  it("uses big tap targets that wrap on the mobile variant", () => {
    const html = renderToStaticMarkup(
      <CheckInReceptionPanel entry={ENTRY} variant="mobile" />,
    );
    expect(html).toMatch(
      /aria-pressed="false"[^>]*class="[^"]*min-h-11[^"]*"[^>]*>Recibido/,
    );
    expect(html).toMatch(/role="group"[^>]*class="[^"]*flex-wrap/);
  });
});

/** H-2: a close that stops midway is shown, not swallowed, and can be retried from the dialog. */
describe("CheckInReceptionPanel — partial close (H-2)", () => {
  it("keeps the dialog open with where the order stopped, and retries with the same button", () => {
    expect(source).toContain('payload?.code === "PARTIAL_CLOSE"');
    expect(source).toContain("setCloseError(");
    expect(source).toMatch(/role="alert"[\s\S]{0,200}\{closeError\}/);
    expect(source).toContain("Reintentar cierre");
  });
});

/** H-3: render test of the partial-close state of the finalize dialog. */
describe("FinalizeConfirmActions (H-3)", () => {
  const props = {
    closing: false,
    variant: "ok" as const,
    onCancel: () => {},
    onConfirm: () => {},
  };

  it("shows the partial-close alert and turns the confirm button into a retry", () => {
    const html = renderToStaticMarkup(
      <FinalizeConfirmActions
        {...props}
        closeError="La devolución quedó a medias: el pedido está en «Devolución»."
      />,
    );
    expect(html).toMatch(
      /role="alert"[^>]*>La devolución quedó a medias: el pedido está en «Devolución»\.</,
    );
    expect(html).toContain(">Reintentar cierre<");
    expect(html).not.toContain(">Confirmar cierre<");
  });

  it("offers a plain confirmation without an error", () => {
    const html = renderToStaticMarkup(
      <FinalizeConfirmActions {...props} closeError={null} />,
    );
    expect(html).not.toContain('role="alert"');
    expect(html).toContain(">Confirmar cierre<");
  });

  it("disables both buttons while closing", () => {
    const html = renderToStaticMarkup(
      <FinalizeConfirmActions {...props} closing closeError={null} />,
    );
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html).toContain(">Cerrando…<");
  });
});
