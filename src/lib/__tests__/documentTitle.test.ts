import { describe, expect, it } from "vitest";

import { documentTitle } from "../documentTitle";

/**
 * T-19 (c): the browser tab must not expose the signed-in admin's email. Most pages build their
 * title as `"<Módulo> | <email>"`; the shared layout strips any email-shaped segment.
 */
describe("documentTitle (T-19c)", () => {
  it("drops a trailing email segment", () => {
    expect(documentTitle("Gestión de Órdenes | admin@mariohans.cl")).toBe(
      "Gestión de Órdenes",
    );
  });

  it("drops an email segment wherever it appears", () => {
    expect(
      documentTitle("Dashboard - Rental Mario Hans | ops@example.com | Hoy"),
    ).toBe("Dashboard - Rental Mario Hans | Hoy");
  });

  it("keeps titles without an email untouched", () => {
    expect(documentTitle("Producto: Profoto B10")).toBe(
      "Producto: Profoto B10",
    );
    expect(documentTitle("Procesar Orden #12 | Bodega")).toBe(
      "Procesar Orden #12 | Bodega",
    );
  });

  it("falls back to the panel name when only an email was given", () => {
    expect(documentTitle("admin@mariohans.cl")).toBe(
      "Panel de Administración - Rental Mario Hans",
    );
    expect(documentTitle("")).toBe(
      "Panel de Administración - Rental Mario Hans",
    );
  });
});
