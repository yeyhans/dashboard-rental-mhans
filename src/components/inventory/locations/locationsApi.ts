import type { WarehouseLocation } from "../../../types/inventory";
import { requestJson, type ApiResult, type UnitsApiOptions } from "../units/unitsApi";
import { buildShelfLevels, type PlanPoint } from "./locationPlan";

export interface LocationWrite {
  location: WarehouseLocation;
  /** Soft checks (outside the room, overlaps): shown, never blocking. */
  warnings: string[];
}

type Versioned = Pick<WarehouseLocation, "id" | "row_version">;

/** Browser client for `/api/inventory/locations` (admin only). */
export function createLocationsApi(options: UnitsApiOptions = {}) {
  const update = (location: Versioned, changes: Record<string, unknown>) =>
    requestJson<LocationWrite>(
      `/api/inventory/locations/${location.id}`,
      { method: "PUT", body: { ...changes, row_version: location.row_version } },
      options,
    );

  return {
    list() {
      return requestJson<{ locations: WarehouseLocation[]; total: number }>("/api/inventory/locations?include_inactive=1", {}, options);
    },
    create(body: Record<string, unknown>) {
      return requestJson<LocationWrite>("/api/inventory/locations", { method: "POST", body }, options);
    },
    update,
    move(location: Versioned, position: PlanPoint) {
      return update(location, { pos_x: position.x, pos_y: position.y });
    },
    deactivate(location: Versioned) {
      return requestJson<{ location: WarehouseLocation }>(
        `/api/inventory/locations/${location.id}?row_version=${location.row_version}`,
        { method: "DELETE" },
        options,
      );
    },
  };
}

export type LocationsApi = ReturnType<typeof createLocationsApi>;

export type CreateWithLevelsResult =
  | { ok: true; created: number; warnings: string[]; failedLevel: { code: string; error: string } | null }
  | { ok: false; error: string };

/**
 * A shelf and its levels are separate rows (levels point at the shelf), so they are created one
 * after another. The first refused level stops the run; what was created stays and is reported.
 */
export async function createLocationWithLevels(
  api: { create: (body: Record<string, unknown>) => Promise<ApiResult<LocationWrite>> },
  draft: Record<string, unknown> & { code: string },
  levels: number,
): Promise<CreateWithLevelsResult> {
  const root = await api.create(draft);
  if (!root.ok) return { ok: false, error: root.error };

  const warnings = [...root.data.warnings];
  let created = 1;
  for (const level of buildShelfLevels({ id: root.data.location.id, code: draft.code }, levels)) {
    const result = await api.create(level);
    if (!result.ok) return { ok: true, created, warnings, failedLevel: { code: level.code, error: result.error } };
    warnings.push(...result.data.warnings);
    created += 1;
  }
  return { ok: true, created, warnings, failedLevel: null };
}
