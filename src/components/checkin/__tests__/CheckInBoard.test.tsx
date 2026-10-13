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

const panelSource = readFileSync(
  fileURLToPath(new URL("../CheckInReceptionPanel.tsx", import.meta.url)),
  "utf8",
);

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
    pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
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
    // The reception panel's "Marcar todos como recibidos" is fine; a "0 / N recibidos" readout is not.
    expect(html).not.toMatch(/\d+ \/ \d+ recibidos/);
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

  it("renders the date filter as a calendar button with the native input hidden (03.1)", () => {
    const html = renderToStaticMarkup(
      <CheckInBoard
        data={makeBoard()}
        todayLabel="Sábado, 13 de junio"
        todayIsoDay="2026-06-13"
      />,
    );
    expect(html).toMatch(
      /<button[^>]*aria-label="Filtrar fecha de devolución"[^>]*>.*<svg[^>]*lucide-calendar/s,
    );
    // The native input stays for the actual picking, but it is not a visible bordered field.
    expect(html).toMatch(/<input[^>]*type="date"[^>]*class="[^"]*sr-only/);
    expect(html).not.toMatch(/<input[^>]*type="date"[^>]*border-border/);
  });

  it("does not show the developer note about line_items / jsonb to the operator (03.4)", () => {
    const html = renderToStaticMarkup(
      <CheckInBoard
        data={makeBoard()}
        todayLabel="Sábado, 13 de junio"
        todayIsoDay="2026-06-13"
      />,
    );
    expect(html).not.toContain("line_items");
    expect(html).not.toContain("jsonb");
    expect(html).not.toContain("busca el número de serie exacto");
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
    // R-04: the item list moved to the reception panel.
    const source = panelSource;
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

describe("CheckInBoard date picker (D-12)", () => {
  it("opens the picker through the guarded helper, not a bare showPicker() call", () => {
    expect(source).toContain("openDatePicker(dateInputRef.current)");
    expect(source).not.toMatch(/input\.showPicker\(\)/);
  });

  it("offers a visible control to clear an applied date", () => {
    expect(source).toMatch(/dateFilter\s*&&/);
    expect(source).toContain('aria-label="Quitar filtro de fecha"');
    expect(source).toContain('setDateFilter("")');
  });

  it("shows no clear control in the initial no-date state", () => {
    const html = renderToStaticMarkup(<CheckInBoard data={makeBoard()} />);
    expect(html).not.toContain("Quitar filtro de fecha");
    expect(html).toContain("Filtrar fecha");
  });
});

/** T-01: the list is paginated on the server; the board links to the neighbouring pages. */
describe("CheckInBoard — pagination (T-01)", () => {
  it("links to the previous and next pages when there is more than one", () => {
    const board = makeBoard();
    board.pagination = { page: 2, pageSize: 50, total: 120, totalPages: 3 };
    const html = renderToStaticMarkup(
      <CheckInBoard data={board} todayLabel="Hoy" todayIsoDay="2026-06-13" />,
    );
    expect(html).toContain('href="?page=1"');
    expect(html).toContain('href="?page=3"');
    expect(html).toContain("Página 2 de 3");
  });

  it("renders no pagination for a single page", () => {
    const html = renderToStaticMarkup(
      <CheckInBoard
        data={makeBoard()}
        todayLabel="Hoy"
        todayIsoDay="2026-06-13"
      />,
    );
    expect(html).not.toContain("Paginación de devoluciones");
  });
});
