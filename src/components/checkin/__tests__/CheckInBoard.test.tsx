import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// `CheckInBoard` imports `apiClient` for the (unopened, in this render) asset check-in control,
// which transitively imports `lib/authService` → `lib/supabase`. That module throws at import
// time outside the browser unless Supabase service-role env vars are set (see its own guard) —
// exactly the same reason every other test touching it mocks it instead of relying on real env.
vi.mock("../../../services/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    handleJsonResponse: vi.fn(),
  },
}));

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import CheckInBoard from "../CheckInBoard";
import type { CheckInBoard as CheckInBoardData } from "../../../services/checkInService";

const source = readFileSync(
  fileURLToPath(new URL("../CheckInBoard.tsx", import.meta.url)),
  "utf8",
);

/**
 * D-15 render test: one row of the list panel, checked against the two findings.
 *
 * `renderToStaticMarkup` only renders the initial (closed) state — no `useEffect`/interaction —
 * which is exactly what the list rows are: no dropdown/portal involved, unlike `RowActionsMenu`.
 */
function makeBoard(
  overrides: Partial<CheckInBoardData["entries"][number]> = {},
): CheckInBoardData {
  return {
    kpis: { pendientesHoy: 1, recibidosHoy: 0, incidencias: 0, atrasadas: 0 },
    entries: [
      {
        id: 1,
        reference: "PED-1",
        client: "Ana Pérez",
        project: "Sesión producto",
        status: "in-rental",
        endDate: "2026-06-20",
        urgency: "scheduled",
        itemCount: 3,
        lineItems: [
          { name: "Cámara X", sku: "CAM-1", product_id: 10, quantity: 3 },
        ] as any,
        ...overrides,
      },
    ],
  };
}

describe("CheckInBoard — list row (D-15)", () => {
  it("shows an honest unit count instead of a fake '0 / N recibidos' progress", () => {
    const html = renderToStaticMarkup(
      <CheckInBoard
        data={makeBoard()}
        todayLabel="Sábado, 13 de junio"
        todayIsoDay="2026-06-13"
      />,
    );
    expect(html).toContain("3 ítems");
    expect(html).not.toContain("recibidos");
  });

  it("shows the dd/mm date alongside the deadline hour when it is not today", () => {
    const html = renderToStaticMarkup(
      <CheckInBoard
        data={makeBoard({ endDate: "2026-06-20", urgency: "scheduled" })}
        todayLabel="Sábado, 13 de junio"
        todayIsoDay="2026-06-13"
      />,
    );
    // endDate 2026-06-20 → deadline 2026-06-21 13:00, "today" is the 13th.
    expect(html).toContain("Vence 21/06 13:00");
  });

  it("shows only the bare hour when the deadline is today", () => {
    const html = renderToStaticMarkup(
      <CheckInBoard
        data={makeBoard({ endDate: "2026-06-12", urgency: "urgent" })}
        todayLabel="Sábado, 13 de junio"
        todayIsoDay="2026-06-13"
      />,
    );
    // endDate 2026-06-12 → deadline 2026-06-13 13:00 === today.
    expect(html).toContain("Vence 13:00");
    expect(html).not.toContain("Vence 13/06 13:00");
  });

  it("hides the deadline entirely for a completed (done) row", () => {
    const html = renderToStaticMarkup(
      <CheckInBoard
        data={makeBoard({
          endDate: "2026-06-01",
          urgency: "done",
          status: "completed",
        })}
        todayLabel="Sábado, 13 de junio"
        todayIsoDay="2026-06-13"
      />,
    );
    expect(html).not.toContain("Vence");
  });
});

describe("CheckInBoard — Filtrar fecha, banda y preselección (D-22)", () => {
  it('renders a "Filtrar fecha" date input in the header', () => {
    const html = renderToStaticMarkup(
      <CheckInBoard
        data={makeBoard()}
        todayLabel="Sábado, 13 de junio"
        todayIsoDay="2026-06-13"
      />,
    );
    expect(html).toContain("Filtrar fecha");
    expect(html).toContain('type="date"');
  });

  it('shows the plain "Devoluciones" band title with no date filter set', () => {
    const html = renderToStaticMarkup(
      <CheckInBoard
        data={makeBoard()}
        todayLabel="Sábado, 13 de junio"
        todayIsoDay="2026-06-13"
      />,
    );
    expect(html).toContain(">Devoluciones<");
    expect(html).not.toContain("Devoluciones hoy");
  });

  it("preselects the first order so the right panel is not empty on load", () => {
    const html = renderToStaticMarkup(
      <CheckInBoard
        data={makeBoard()}
        todayLabel="Sábado, 13 de junio"
        todayIsoDay="2026-06-13"
      />,
    );
    expect(html).not.toContain(
      "Selecciona un pedido para revisar los equipos.",
    );
    expect(html).toContain("Ana Pérez");
  });

  it("uses the JetBrains Mono token (not the system mono stack) for the detail figures", () => {
    const html = renderToStaticMarkup(
      <CheckInBoard
        data={makeBoard()}
        todayLabel="Sábado, 13 de junio"
        todayIsoDay="2026-06-13"
      />,
    );
    expect(html).toContain("var(--font-mono)");
  });
});

describe("CheckInBoard — mobile pass (D-25)", () => {
  it("does not cap the returns list height or scroll it on its own below the lg breakpoint (no double scroll)", () => {
    expect(source).not.toMatch(/className="max-h-\[560px\] overflow-y-auto"/);
    expect(source).toContain("lg:max-h-[560px] lg:overflow-y-auto");
  });

  it("does not cap the item list height or scroll it on its own below the lg breakpoint either", () => {
    expect(source).not.toMatch(/className="max-h-\[300px\] overflow-y-auto"/);
    expect(source).toContain("lg:max-h-[300px] lg:overflow-y-auto");
  });

  it("derives the effective selection through resolveVisibleSelection instead of trusting selectedId blindly", () => {
    expect(source).toContain("resolveVisibleSelection");
    expect(source).toContain('from "../../lib/checkInDateFilter"');
    expect(source).toContain("resolveVisibleSelection(visible, selectedId)");
    expect(source).toContain("entry.id === effectiveSelectedId");
  });
});

describe("CheckInBoard — D-27 follow-up", () => {
  it("persists the resolved fallback selection back into state (R3-checkin-effective-selection-not-persisted)", () => {
    // `renderToStaticMarkup` does not run effects, so this stays a source assertion (same reason
    // as the mobile-pass block above): a later action relying on `selectedId` — e.g. clearing the
    // date filter — must read the entry actually shown, not the hidden one `setSelectedId` was
    // last called with.
    expect(source).toContain("useEffect(() => {");
    expect(source).toMatch(
      /useEffect\(\(\) => \{\s*if \(effectiveSelectedId !== selectedId\) setSelectedId\(effectiveSelectedId\);\s*\}, \[effectiveSelectedId, selectedId\]\);/,
    );
  });
});
