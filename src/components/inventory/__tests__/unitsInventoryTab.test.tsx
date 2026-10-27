import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { createUnitsApi } from "../units/unitsApi";
import { buildLabelsHref, buildUnitPatch, saveUnitEdit } from "../units/unitEdits";
import { validateBulkUnitsForm, type BulkUnitsFormValues } from "../units/bulkUnitsForm";
import { flattenLocationTree } from "../units/locationOptions";
import { UnitsTable, type UnitsTableProps } from "../units/UnitsTable";
import type { InventoryUnitView } from "../../../services/serialisedAssetService";
import type { LocationTreeNode } from "../../../lib/warehouseLocations";
import type { WarehouseLocation } from "../../../types/inventory";

function unit(partial: Partial<InventoryUnitView> = {}): InventoryUnitView {
  return {
    id: 7,
    product_id: 3,
    asset_tag: "MH-00007",
    serial_number: "SN-123",
    condition: "operational",
    wear: "used",
    location: "N-E1 · Estante 1",
    location_id: "loc-1",
    kit_code: null,
    notes: null,
    acquisition_cost: null,
    purchase_date: null,
    market_price: null,
    row_version: 4,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    status: "operational",
    open_order_id: null,
    location_detail: { id: "loc-1", code: "N-E1", name: "Estante 1", kind: "shelf" },
    ...partial,
  };
}

function location(partial: Partial<WarehouseLocation>): WarehouseLocation {
  return {
    id: "x",
    code: "N-E1",
    name: "Estante 1",
    kind: "shelf",
    parent_id: null,
    wall: "N",
    pos_x: 1,
    pos_y: 0.3,
    width: 1.2,
    depth: 0.4,
    height: null,
    level_index: null,
    rotation_deg: 0,
    is_active: true,
    row_version: 1,
    created_at: "",
    updated_at: "",
    updated_by: null,
    ...partial,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("unitsApi", () => {
  it("PUTs an inline edit with the row_version the row was read at", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: true, data: unit({ serial_number: "NEW", row_version: 5 }) }));
    const api = createUnitsApi({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await api.updateUnit(unit(), { serial_number: "NEW" });

    expect(result).toMatchObject({ ok: true, data: { row_version: 5 } });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/inventory/assets/7");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ serial_number: "NEW", row_version: 4 });
  });

  it("sends the bearer token when one is given", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: true, data: { units: [], total: 0 } }));
    const api = createUnitsApi({ fetchImpl: fetchImpl as unknown as typeof fetch, accessToken: "tok" });
    await api.listUnits(3);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/inventory/products/3/units");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("flags a 409 CONFLICT as a version conflict", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ success: false, error: "La unidad fue modificada por otra persona; recarga", code: "CONFLICT" }, 409),
    );
    const api = createUnitsApi({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await api.archiveUnit(unit());
    expect(result).toEqual({
      ok: false,
      status: 409,
      code: "CONFLICT",
      isConflict: true,
      error: "La unidad fue modificada por otra persona; recarga",
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/inventory/assets/7/archive");
    expect(JSON.parse(String(init.body))).toEqual({ row_version: 4 });
  });

  it("a 409 without the CONFLICT code is not a version conflict", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: false, error: "Ya existe un equipo registrado con ese número de serie" }, 409));
    const api = createUnitsApi({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await api.updateUnit(unit(), { serial_number: "DUP" });
    expect(result).toMatchObject({ ok: false, isConflict: false, status: 409 });
  });

  it("relocates with the target, the row_version and optional notes", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: true, data: { relocation: {}, unit: unit({ row_version: 5 }) } }));
    const api = createUnitsApi({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await api.relocateUnit(unit(), "loc-2", "  ");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/inventory/assets/7/relocate");
    expect(JSON.parse(String(init.body))).toEqual({ to_location_id: "loc-2", row_version: 4 });
  });

  it("returns a generic Spanish error when the network fails", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const api = createUnitsApi({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await api.listLocationTree();
    expect(result).toMatchObject({ ok: false, status: 0, isConflict: false });
    if (!result.ok) expect(result.error).toMatch(/conexión/);
  });
});

describe("buildUnitPatch / saveUnitEdit", () => {
  it("returns null when nothing changed", () => {
    expect(buildUnitPatch(unit(), { serial_number: " SN-123 " })).toBeNull();
    expect(buildUnitPatch(unit(), { notes: "" })).toBeNull();
  });

  it("trims, and clears blank notes to null", () => {
    expect(buildUnitPatch(unit({ notes: "raya" }), { notes: "  " })).toEqual({ ok: true, patch: { notes: null } });
    expect(buildUnitPatch(unit(), { serial_number: " SN-9 " })).toEqual({ ok: true, patch: { serial_number: "SN-9" } });
  });

  it("refuses an empty serial number", () => {
    expect(buildUnitPatch(unit(), { serial_number: "  " })).toEqual({ ok: false, error: "El número de serie es obligatorio" });
  });

  it("saves through the api and returns the fresh unit", async () => {
    const updateUnit = vi.fn(async () => ({ ok: true as const, data: unit({ wear: "new", row_version: 5 }) }));
    const outcome = await saveUnitEdit({ updateUnit }, unit(), { wear: "new" });
    expect(updateUnit).toHaveBeenCalledWith(unit(), { wear: "new" });
    expect(outcome).toMatchObject({ kind: "saved", unit: { row_version: 5 } });
  });

  it("reports a conflict so the tab reloads the list", async () => {
    const updateUnit = vi.fn(async () => ({
      ok: false as const,
      status: 409,
      code: "CONFLICT",
      isConflict: true,
      error: "La unidad fue modificada por otra persona; recarga",
    }));
    const outcome = await saveUnitEdit({ updateUnit }, unit(), { condition: "blocked" });
    expect(outcome).toEqual({ kind: "conflict", message: "La unidad fue modificada por otra persona; recarga" });
  });

  it("does not call the api when nothing changed or the edit is invalid", async () => {
    const updateUnit = vi.fn();
    expect(await saveUnitEdit({ updateUnit }, unit(), { wear: "used" })).toEqual({ kind: "unchanged" });
    expect(await saveUnitEdit({ updateUnit }, unit(), { serial_number: "" })).toEqual({
      kind: "error",
      message: "El número de serie es obligatorio",
    });
    expect(updateUnit).not.toHaveBeenCalled();
  });

  it("builds the labels link for the listed units", () => {
    expect(buildLabelsHref([unit(), unit({ id: 8, asset_tag: "MH-00008" })])).toBe("/inventory/labels?tags=MH-00007,MH-00008");
    expect(buildLabelsHref([])).toBe("/inventory/labels");
  });
});

describe("validateBulkUnitsForm", () => {
  const base: BulkUnitsFormValues = {
    count: "3",
    wear: "new",
    condition: "operational",
    location_id: "loc-1",
    location_text: "",
    serial_prefix: "",
  };

  it("builds the bulk payload", () => {
    expect(validateBulkUnitsForm({ ...base, serial_prefix: " cam " }, "many")).toEqual({
      ok: true,
      payload: { count: 3, wear: "new", condition: "operational", location_id: "loc-1", serial_prefix: "CAM" },
    });
  });

  it("uses the legacy location text when no location is picked", () => {
    expect(validateBulkUnitsForm({ ...base, location_id: "", location_text: " Bodega " }, "many")).toEqual({
      ok: true,
      payload: { count: 3, wear: "new", condition: "operational", location: "Bodega" },
    });
  });

  it("rejects a count outside 1..50 or not an integer", () => {
    for (const count of ["0", "51", "2.5", "", "abc"]) {
      const result = validateBulkUnitsForm({ ...base, count }, "many");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.count).toBe("La cantidad debe ser un número entero entre 1 y 50");
    }
  });

  it("requires a location", () => {
    const result = validateBulkUnitsForm({ ...base, location_id: "", location_text: " " }, "many");
    expect(result).toEqual({ ok: false, errors: { location_id: "La ubicación es obligatoria" } });
  });

  it("rejects a malformed serial prefix", () => {
    const result = validateBulkUnitsForm({ ...base, serial_prefix: "con espacio" }, "many");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.serial_prefix).toMatch(/prefijo de serie/);
  });

  it("forces one unit in single mode whatever the count field says", () => {
    const result = validateBulkUnitsForm({ ...base, count: "" }, "single");
    expect(result).toMatchObject({ ok: true, payload: { count: 1 } });
  });
});

describe("flattenLocationTree", () => {
  it("lists every node depth-first with its depth and a code · name label", () => {
    const shelf = location({ id: "s", code: "N-E1", name: "Estante 1" });
    const level = location({ id: "l", code: "N-E1-N1", name: "Nivel 1", kind: "level", parent_id: "s" });
    const rug = location({ id: "r", code: "C-ALF", name: "Alfombra central", kind: "rug", wall: "C" });
    const tree: LocationTreeNode[] = [
      { ...rug, children: [] },
      { ...shelf, children: [{ ...level, children: [] }] },
    ];
    expect(flattenLocationTree(tree)).toEqual([
      { id: "r", code: "C-ALF", label: "C-ALF · Alfombra central", depth: 0 },
      { id: "s", code: "N-E1", label: "N-E1 · Estante 1", depth: 0 },
      { id: "l", code: "N-E1-N1", label: "N-E1-N1 · Nivel 1", depth: 1 },
    ]);
  });
});

describe("UnitsTable", () => {
  const noop = () => {};
  const props = (partial: Partial<UnitsTableProps> = {}): UnitsTableProps => ({
    units: [unit(), unit({ id: 8, asset_tag: "MH-00008", serial_number: "SN-8", status: "in_rental", open_order_id: 501 })],
    locationOptions: [
      { id: "loc-1", code: "N-E1", label: "N-E1 · Estante 1", depth: 0 },
      { id: "loc-2", code: "N-E2", label: "N-E2 · Estante 2", depth: 0 },
    ],
    busyIds: new Set<number>(),
    onCommit: noop,
    onRelocate: noop,
    onRequestRelocate: noop,
    onArchive: noop,
    onAddUnit: noop,
    onAddMany: noop,
    labelsHref: "/inventory/labels?tags=MH-00007,MH-00008",
    ...partial,
  });

  it("renders the canon columns with the asset tag in mono", () => {
    const html = renderToStaticMarkup(<UnitsTable {...props()} />);
    for (const header of ["#", "Código", "N° de serie", "Condición", "Estado", "Ubicación", "Observaciones"]) {
      expect(html).toContain(`>${header}<`);
    }
    expect(html).toMatch(/font-mono[^>]*>MH-00007</);
    expect(html).toContain('value="SN-123"');
    expect(html).toContain(">001<");
    expect(html).toContain(">002<");
  });

  it("shows the derived rental state read-only with its order", () => {
    const html = renderToStaticMarkup(<UnitsTable {...props()} />);
    expect(html).toContain("En arriendo");
    expect(html).toContain("Pedido #501");
  });

  it("selects the unit's warehouse location, falling back to the legacy text", () => {
    const html = renderToStaticMarkup(
      <UnitsTable {...props({ units: [unit({ location_id: null, location_detail: null, location: "Repisa vieja" })] })} />,
    );
    expect(html).toContain("Repisa vieja (texto anterior)");
  });

  it("has the footer count, the add buttons and the labels link", () => {
    const html = renderToStaticMarkup(<UnitsTable {...props()} />);
    expect(html).toContain("2 unidades registradas");
    expect(html).toContain("Agregar unidad");
    expect(html).toContain("Agregar varias");
    expect(html).toContain('href="/inventory/labels?tags=MH-00007,MH-00008"');
    expect(html).toContain("Imprimir etiquetas");
  });

  it("renders mobile cards titled Unidad 001", () => {
    const html = renderToStaticMarkup(<UnitsTable {...props()} />);
    expect(html).toContain("Unidad 001");
    expect(html).toContain("Unidad 002");
  });

  it("has row actions Reubicar and Archivar with accessible names", () => {
    const html = renderToStaticMarkup(<UnitsTable {...props()} />);
    expect(html).toContain('aria-label="Reubicar MH-00007"');
    expect(html).toContain('aria-label="Archivar MH-00007"');
  });

  it("renders the empty state when there are no units", () => {
    const html = renderToStaticMarkup(<UnitsTable {...props({ units: [] })} />);
    expect(html).toContain("Este equipo aún no tiene unidades registradas");
    expect(html).toContain("Agregar unidad");
    expect(html).not.toContain("unidades registradas</span>");
  });

  it("uses the singular for one unit", () => {
    const html = renderToStaticMarkup(<UnitsTable {...props({ units: [unit()] })} />);
    expect(html).toContain("1 unidad registrada");
  });
});
