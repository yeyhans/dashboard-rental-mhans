import { describe, expect, it, vi } from "vitest";

import { createLocationsApi, createLocationWithLevels } from "../locations/locationsApi";
import type { WarehouseLocation } from "../../../types/inventory";

function location(partial: Partial<WarehouseLocation>): WarehouseLocation {
  return {
    id: "s",
    code: "N-E1",
    name: "Estante 1",
    kind: "shelf",
    parent_id: null,
    wall: "N",
    pos_x: 2.5,
    pos_y: 0.3,
    width: 1.2,
    depth: 0.4,
    height: null,
    level_index: null,
    rotation_deg: 0,
    is_active: true,
    row_version: 3,
    created_at: "",
    updated_at: "",
    updated_by: null,
    ...partial,
  };
}

const ok = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, data }), { status });

describe("locationsApi", () => {
  it("moves a location with only the new position and its row_version", async () => {
    const fetchImpl = vi.fn(async () => ok({ location: location({ pos_x: 2.6, row_version: 4 }), warnings: [] }));
    const api = createLocationsApi({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await api.move(location({}), { x: 2.6, y: 0.3 });
    expect(result).toMatchObject({ ok: true, data: { location: { row_version: 4 } } });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/inventory/locations/s");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ pos_x: 2.6, pos_y: 0.3, row_version: 3 });
  });

  it("deactivates with the row_version in the query string", async () => {
    const fetchImpl = vi.fn(async () => ok({ location: location({ is_active: false }) }));
    const api = createLocationsApi({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await api.deactivate(location({}));
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/inventory/locations/s?row_version=3");
    expect(init.method).toBe("DELETE");
  });

  it("lists active and inactive locations", async () => {
    const fetchImpl = vi.fn(async () => ok({ locations: [], total: 0 }));
    const api = createLocationsApi({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await api.list();
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("/api/inventory/locations?include_inactive=1");
  });
});

describe("createLocationWithLevels", () => {
  it("creates the shelf, then each level under it, and collects warnings", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, data: { location: location({ id: "new" }), warnings: ["Se superpone con N-E2"] } })
      .mockResolvedValue({ ok: true, data: { location: location({ id: "lvl", kind: "level" }), warnings: [] } });

    const result = await createLocationWithLevels({ create }, { code: "N-E1", kind: "shelf" }, 2);

    expect(create).toHaveBeenCalledTimes(3);
    expect(create.mock.calls[1]?.[0]).toEqual({ code: "N-E1-N1", name: "Nivel 1", kind: "level", parent_id: "new", level_index: 1 });
    expect(result).toEqual({ ok: true, created: 3, warnings: ["Se superpone con N-E2"], failedLevel: null });
  });

  it("stops at the first failing level and reports which one", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, data: { location: location({ id: "new" }), warnings: [] } })
      .mockResolvedValueOnce({ ok: false, status: 409, error: "Ya existe una ubicación con ese código", isConflict: false });

    const result = await createLocationWithLevels({ create }, { code: "N-E1", kind: "shelf" }, 3);
    expect(create).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      ok: true,
      created: 1,
      warnings: [],
      failedLevel: { code: "N-E1-N1", error: "Ya existe una ubicación con ese código" },
    });
  });

  it("fails when the shelf itself is refused", async () => {
    const create = vi.fn().mockResolvedValueOnce({ ok: false, status: 400, error: "Muro inválido", isConflict: false });
    expect(await createLocationWithLevels({ create }, { code: "N-E1", kind: "shelf" }, 2)).toEqual({ ok: false, error: "Muro inválido" });
  });
});
