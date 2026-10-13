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

describe("DeliveryBoard — new shipping type button (04.1)", () => {
  // R-07: the client renamed the service "Delivery" (2026-10-13); it overrides the canon's
  // "Envío" wording, the button shape stays as the canon has it.
  it('labels the create button "Nuevo Tipo de Delivery"', () => {
    const html = renderToStaticMarkup(<DeliveryBoard data={makeBoard()} />);
    expect(html).toContain("Nuevo Tipo de Delivery");
    expect(html).not.toContain("Nuevo tipo<");
  });
});

/** R-06: the driver (conductor) column and the "Filtrar por conductor" filter of the canon. */
describe("DeliveryBoard — conductor (R-06)", () => {
  function shipment(id: number, driverName: string | null) {
    return {
      id,
      orderId: 100 + id,
      orderReference: `PED-${100 + id}`,
      client: "Fábula Films",
      project: "KIA",
      methodId: 1,
      methodName: "Estándar",
      cost: 15000,
      status: "pending",
      trackingNumber: null,
      createdAt: "2026-10-13T12:00:00Z",
      deliveredAt: null,
      lineItems: [],
      driverName,
    };
  }

  function boardWithDrivers() {
    const board = makeBoard();
    board.active = [shipment(1, "Carlos R."), shipment(2, null)];
    board.history = [shipment(1, "Carlos R."), shipment(3, "Juan P.")];
    return board;
  }

  it("renders a Conductor column in the active and history tables", () => {
    const html = renderToStaticMarkup(
      <DeliveryBoard data={boardWithDrivers()} />,
    );
    expect(html.split(">Conductor</th>").length - 1).toBe(2);
    expect(html).toContain("Carlos R.");
    expect(html).toContain("Juan P.");
    expect(html).toContain("Sin asignar");
  });

  it("offers a driver filter built from the drivers in the history", () => {
    const html = renderToStaticMarkup(
      <DeliveryBoard data={boardWithDrivers()} />,
    );
    expect(html).toContain('aria-label="Filtrar por conductor"');
    expect(html).toContain("Todos los conductores");
    expect(html).toMatch(/<option value="Carlos R.">Carlos R.<\/option>/);
    expect(html).toMatch(/<option value="Juan P.">Juan P.<\/option>/);
  });
});
