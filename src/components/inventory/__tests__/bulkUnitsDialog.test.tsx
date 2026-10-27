import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  BulkUnitsFields,
  initialBulkUnitsValues,
  summarizeBulkUnits,
} from "../units/BulkUnitsDialog";

const options = [
  { id: "loc-1", code: "N-E1", label: "N-E1 · Estante 1", depth: 0 },
  { id: "loc-2", code: "N-E1-N1", label: "N-E1-N1 · Nivel 1", depth: 1 },
];

describe("BulkUnitsFields (flujo único de inventario)", () => {
  it("asks for cantidad, condición, estado and ubicación in one form, with no mode switch", () => {
    const html = renderToStaticMarkup(
      <BulkUnitsFields
        values={initialBulkUnitsValues()}
        errors={{}}
        locationOptions={options}
        onChange={() => {}}
      />,
    );
    expect(html).toContain(">Cantidad<");
    expect(html).toContain(">Condición<");
    expect(html).toContain(">Estado<");
    expect(html).toContain(">Ubicación<");
    expect(html).toContain('max="50"');
    expect(html).toContain("N-E1-N1 · Nivel 1");
    expect(html).not.toContain(">Archivado<");
    expect(html).not.toContain(">En arriendo<");
  });

  it("starts with one unit, so the common case is a single click", () => {
    expect(initialBulkUnitsValues().count).toBe("1");
  });

  it("returns fresh values on every call, so closing the dialog resets it without sharing state", () => {
    const first = initialBulkUnitsValues();
    first.count = "9";
    expect(initialBulkUnitsValues().count).toBe("1");
  });

  it("keeps the serial prefix out of the way, inside advanced options", () => {
    const html = renderToStaticMarkup(
      <BulkUnitsFields
        values={initialBulkUnitsValues()}
        errors={{}}
        locationOptions={options}
        onChange={() => {}}
      />,
    );
    expect(html).toContain("<details");
    expect(html).toContain("Opciones avanzadas");
    expect(html.indexOf("Opciones avanzadas")).toBeLessThan(
      html.indexOf("Prefijo de serie (opcional)"),
    );
  });

  it("links to the warehouse map so a missing location can be created on the spot", () => {
    const withOptions = renderToStaticMarkup(
      <BulkUnitsFields
        values={initialBulkUnitsValues()}
        errors={{}}
        locationOptions={options}
        onChange={() => {}}
      />,
    );
    const withoutOptions = renderToStaticMarkup(
      <BulkUnitsFields
        values={initialBulkUnitsValues()}
        errors={{}}
        locationOptions={[]}
        onChange={() => {}}
      />,
    );
    expect(withOptions).toContain('href="/inventory/ubicaciones"');
    expect(withoutOptions).toContain('href="/inventory/ubicaciones"');
  });

  it("shows the field errors next to their fields, linked by aria-describedby", () => {
    const html = renderToStaticMarkup(
      <BulkUnitsFields
        values={initialBulkUnitsValues()}
        errors={{
          count: "La cantidad debe ser un número entero entre 1 y 50",
          location_id: "La ubicación es obligatoria",
        }}
        locationOptions={options}
        onChange={() => {}}
      />,
    );
    expect(html).toContain(
      "La cantidad debe ser un número entero entre 1 y 50",
    );
    expect(html).toContain("La ubicación es obligatoria");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="bulk-count-error"');
  });

  it("offers free text when the warehouse has no locations yet", () => {
    const html = renderToStaticMarkup(
      <BulkUnitsFields
        values={initialBulkUnitsValues()}
        errors={{}}
        locationOptions={[]}
        onChange={() => {}}
      />,
    );
    expect(html).toContain('placeholder="Ej: Bodega principal, repisa 2"');
  });
});

describe("summarizeBulkUnits (resumen antes de guardar)", () => {
  it("states what will be created, in plural for more than one unit", () => {
    const text = summarizeBulkUnits(
      { ...initialBulkUnitsValues(), count: "3", location_id: "loc-1" },
      "Canon R5",
      options,
    );
    expect(text).toContain("Se crearán 3 unidades de Canon R5");
    expect(text).toContain("N-E1 · Estante 1");
  });

  it("uses the singular for a single unit", () => {
    const text = summarizeBulkUnits(
      { ...initialBulkUnitsValues(), count: "1", location_id: "loc-1" },
      "Canon R5",
      options,
    );
    expect(text).toContain("Se creará 1 unidad de Canon R5");
  });

  it("asks for a valid quantity instead of summarising an impossible one", () => {
    for (const count of ["", "0", "2.5", "-1", "60"]) {
      const text = summarizeBulkUnits(
        { ...initialBulkUnitsValues(), count, location_id: "loc-1" },
        "Canon R5",
        options,
      );
      expect(text, `count=${count}`).toBe(
        "Revisa la cantidad: entre 1 y 50 unidades por vez.",
      );
    }
  });

  it("falls back to the typed location when there is no map location", () => {
    const text = summarizeBulkUnits(
      {
        ...initialBulkUnitsValues(),
        count: "2",
        location_text: "Bodega principal, repisa 2",
      },
      "Canon R5",
      [],
    );
    expect(text).toContain("Bodega principal, repisa 2");
  });
});
