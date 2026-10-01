import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Same reason as `CheckInBoard.test.tsx`: `apiClient` transitively imports `lib/supabase`, which
// throws at import time outside the browser without service-role env vars.
vi.mock("../../../services/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

import DeliveryBoard from "../DeliveryBoard";
import type { DeliveryBoard as DeliveryBoardData } from "../../../services/deliveryService";

function makeBoard(): DeliveryBoardData {
  return {
    kpis: {
      enviosHoy: 0,
      enviosAyer: 0,
      variacionDiaria: null,
      porDespachar: 0,
      entregadosHoy: 0,
      costoHoy: 0,
      costoSemana: 0,
      costoMes: 0,
    },
    totals: { totalEnvios: 0, costoTotal: 0, promedioPorEnvio: 0 },
    active: [],
    history: [],
    types: [],
  };
}

describe("DeliveryBoard — page header (D-22)", () => {
  it("renders the title through the shared PageHeader (uppercase per canon)", () => {
    const html = renderToStaticMarkup(<DeliveryBoard data={makeBoard()} />);
    // PageHeader's h1 carries the `uppercase` utility class (D-03) — before D-22 this page used
    // a raw `<header>` in `delivery.astro` that never went through it.
    expect(html).toMatch(/<h1[^>]*uppercase[^>]*>Delivery<\/h1>/);
  });
});
