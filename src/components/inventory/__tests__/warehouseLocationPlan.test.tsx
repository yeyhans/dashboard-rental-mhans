import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  buildLocationDraft,
  buildShelfLevels,
  clampToRoom,
  nudgePosition,
  planItems,
  pointerToRoom,
  snapToGrid,
  suggestLocationCode,
  type NewLocationForm,
} from "../locations/locationPlan";
import { WarehousePlan } from "../locations/WarehousePlan";
import type { WarehouseLocation } from "../../../types/inventory";

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

describe("grid helpers", () => {
  it("snaps to 0.1 m without float noise", () => {
    expect(snapToGrid(1.23)).toBe(1.2);
    expect(snapToGrid(1.25)).toBe(1.3);
    expect(snapToGrid(0.30000000000000004)).toBe(0.3);
  });

  it("clamps into the 5 x 5 m room", () => {
    expect(clampToRoom(-0.4)).toBe(0);
    expect(clampToRoom(5.7)).toBe(5);
    expect(clampToRoom(2.5)).toBe(2.5);
  });

  it("nudges 0.1 m with the arrows, 0.5 m with shift, and ignores other keys", () => {
    expect(nudgePosition({ x: 1, y: 1 }, "ArrowRight", false)).toEqual({ x: 1.1, y: 1 });
    expect(nudgePosition({ x: 1, y: 1 }, "ArrowUp", false)).toEqual({ x: 1, y: 0.9 });
    expect(nudgePosition({ x: 1, y: 1 }, "ArrowDown", true)).toEqual({ x: 1, y: 1.5 });
    expect(nudgePosition({ x: 0, y: 1 }, "ArrowLeft", false)).toEqual({ x: 0, y: 1 });
    expect(nudgePosition({ x: 1, y: 1 }, "Enter", false)).toBeNull();
  });

  it("maps a pointer position on the plan to snapped room metres", () => {
    const rect = { left: 100, top: 50, width: 560, height: 560 };
    // viewBox is -30..530 (560 units), 100 units per metre: the room origin sits 30 px in.
    expect(pointerToRoom(100 + 30 + 123, 50 + 30 + 251, rect)).toEqual({ x: 1.2, y: 2.5 });
    expect(pointerToRoom(0, 0, rect)).toEqual({ x: 0, y: 0 });
  });
});

describe("planItems", () => {
  it("draws active root items with a position, defaulting the footprint by kind", () => {
    const items = planItems(
      [
        location({ id: "s", code: "N-E1" }),
        location({ id: "l", code: "N-E1-N1", kind: "level", parent_id: "s", pos_x: null, pos_y: null }),
        location({ id: "b", code: "S-CJ1", kind: "box", wall: "S", pos_x: 2, pos_y: 4.7, width: null, depth: null }),
        location({ id: "off", code: "W-E9", is_active: false }),
        location({ id: "nopos", code: "W-P1", kind: "floor", pos_x: null, pos_y: null }),
      ],
      { s: 4, l: 2, b: 1 },
    );
    expect(items.map((item) => item.id)).toEqual(["s", "b"]);
    expect(items[0]).toMatchObject({ unitCount: 6, width: 1.2, depth: 0.4 });
    expect(items[1]).toMatchObject({ unitCount: 1, width: 0.4, depth: 0.3 });
  });
});

describe("new location helpers", () => {
  it("suggests the next free code per wall and kind", () => {
    expect(suggestLocationCode("N", "shelf", ["N-E1", "N-E2", "S-E1"])).toBe("N-E3");
    expect(suggestLocationCode("S", "box", [])).toBe("S-CJ1");
    expect(suggestLocationCode("W", "floor", ["W-P1"])).toBe("W-P2");
  });

  it("builds the create payload with the wall's default position and rotation", () => {
    const form: NewLocationForm = { kind: "shelf", wall: "E", code: " e-e1 ", name: " Estante luces ", levels: "3" };
    expect(buildLocationDraft(form)).toEqual({
      ok: true,
      draft: {
        code: "E-E1",
        name: "Estante luces",
        kind: "shelf",
        wall: "E",
        parent_id: null,
        pos_x: 4.7,
        pos_y: 2.5,
        width: 1.2,
        depth: 0.4,
        rotation_deg: 90,
      },
      levels: 3,
    });
  });

  it("validates code, name and level count before calling the server", () => {
    const base: NewLocationForm = { kind: "shelf", wall: "N", code: "N-E1", name: "Estante", levels: "0" };
    expect(buildLocationDraft({ ...base, code: "bad code" })).toMatchObject({ ok: false, error: expect.stringMatching(/formato/) });
    expect(buildLocationDraft({ ...base, name: "  " })).toMatchObject({ ok: false, error: expect.stringMatching(/nombre/) });
    expect(buildLocationDraft({ ...base, levels: "9" })).toMatchObject({ ok: false, error: expect.stringMatching(/niveles/) });
    expect(buildLocationDraft({ ...base, kind: "box", levels: "9" })).toMatchObject({ ok: true, levels: 0 });
  });

  it("builds the levels of a shelf", () => {
    expect(buildShelfLevels({ id: "s", code: "N-E1" }, 2)).toEqual([
      { code: "N-E1-N1", name: "Nivel 1", kind: "level", parent_id: "s", level_index: 1 },
      { code: "N-E1-N2", name: "Nivel 2", kind: "level", parent_id: "s", level_index: 2 },
    ]);
  });
});

describe("WarehousePlan", () => {
  it("renders the room with its four walls and one focusable item per location", () => {
    const items = planItems([location({ id: "s", code: "N-E1", name: "Estante 1" })], { s: 3 });
    const html = renderToStaticMarkup(
      <WarehousePlan items={items} selectedId="s" onSelect={() => {}} onMove={() => {}} />,
    );
    expect(html).toContain("<svg");
    for (const wall of ["Muro norte", "Muro este", "Muro sur", "Muro oeste"]) expect(html).toContain(wall);
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="N-E1 · Estante 1, 3 unidades, x 1,0 m, y 0,3 m"');
    expect(html).toContain('aria-pressed="true"');
  });

  it("omits the unit count when it is unknown instead of claiming zero", () => {
    const items = planItems([location({ id: "s", code: "N-E1", name: "Estante 1" })], null);
    expect(items[0]?.unitCount).toBeNull();
    const html = renderToStaticMarkup(<WarehousePlan items={items} selectedId={null} onSelect={() => {}} onMove={() => {}} />);
    expect(html).toContain('aria-label="N-E1 · Estante 1, x 1,0 m, y 0,3 m"');
  });
});
