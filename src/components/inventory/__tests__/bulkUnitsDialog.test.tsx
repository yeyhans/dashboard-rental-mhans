import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BulkUnitsFields, initialBulkUnitsValues } from "../units/BulkUnitsDialog";

const options = [
  { id: "loc-1", code: "N-E1", label: "N-E1 · Estante 1", depth: 0 },
  { id: "loc-2", code: "N-E1-N1", label: "N-E1-N1 · Nivel 1", depth: 1 },
];

describe("BulkUnitsFields (Agregar varias)", () => {
  it("asks for cantidad, condición, estado, ubicación and the optional serial prefix", () => {
    const html = renderToStaticMarkup(
      <BulkUnitsFields mode="many" values={initialBulkUnitsValues()} errors={{}} locationOptions={options} onChange={() => {}} />,
    );
    expect(html).toContain(">Cantidad<");
    expect(html).toContain(">Condición<");
    expect(html).toContain(">Estado<");
    expect(html).toContain(">Ubicación<");
    expect(html).toContain("Prefijo de serie (opcional)");
    expect(html).toContain('max="50"');
    expect(html).toContain("N-E1-N1 · Nivel 1");
    expect(html).not.toContain(">Archivado<");
    expect(html).not.toContain(">En arriendo<");
  });

  it("hides the count and the prefix when adding a single unit", () => {
    const html = renderToStaticMarkup(
      <BulkUnitsFields mode="single" values={initialBulkUnitsValues()} errors={{}} locationOptions={options} onChange={() => {}} />,
    );
    expect(html).not.toContain(">Cantidad<");
    expect(html).not.toContain("Prefijo de serie");
    expect(html).toContain("N° de serie");
  });

  it("shows the field errors next to their fields, linked by aria-describedby", () => {
    const html = renderToStaticMarkup(
      <BulkUnitsFields
        mode="many"
        values={initialBulkUnitsValues()}
        errors={{ count: "La cantidad debe ser un número entero entre 1 y 50", location_id: "La ubicación es obligatoria" }}
        locationOptions={options}
        onChange={() => {}}
      />,
    );
    expect(html).toContain("La cantidad debe ser un número entero entre 1 y 50");
    expect(html).toContain("La ubicación es obligatoria");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="bulk-count-error"');
  });

  it("offers free text when the warehouse has no locations yet", () => {
    const html = renderToStaticMarkup(
      <BulkUnitsFields mode="many" values={initialBulkUnitsValues()} errors={{}} locationOptions={[]} onChange={() => {}} />,
    );
    expect(html).toContain('placeholder="Ej: Bodega principal, repisa 2"');
  });
});
