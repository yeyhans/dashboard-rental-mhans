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

import CheckInBoard from "../CheckInBoard";
import type { CheckInBoard as CheckInBoardData } from "../../../services/checkInService";

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
