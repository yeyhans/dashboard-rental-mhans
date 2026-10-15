import { LOCATION_ERRORS, normalizeLocationCode } from "../../../lib/warehouseLocations";
import {
  LOCATION_CODE_PATTERN,
  WAREHOUSE_ROOM_SIZE_M,
  type LocationKind,
  type RotationDeg,
  type Wall,
  type WarehouseLocation,
} from "../../../types/inventory";

/**
 * Pure geometry of the 2D warehouse editor. Metres from the room's top-left corner (north wall at
 * the top); positions are the CENTRE of an item's footprint, like `validateLocation` and the
 * seeded rug at 2.5/2.5.
 */
export const SNAP_M = 0.1;
export const BIG_STEP_M = 0.5;
/** SVG units per metre; the viewBox adds a 30-unit margin for the wall labels. */
export const PLAN_SCALE = 100;
export const PLAN_MARGIN = 30;
export const PLAN_VIEW_SIZE = WAREHOUSE_ROOM_SIZE_M * PLAN_SCALE + PLAN_MARGIN * 2;

export const MAX_SHELF_LEVELS = 8;

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Nearest 0.1 m. Works in tenths (and a tiny epsilon) so 1.25 rounds up and float noise vanishes. */
export function snapToGrid(value: number): number {
  return Math.round(value / SNAP_M + 1e-9) / 10;
}

export function clampToRoom(value: number): number {
  return Math.min(WAREHOUSE_ROOM_SIZE_M, Math.max(0, value));
}

export interface PlanPoint {
  x: number;
  y: number;
}

const ARROWS: Record<string, PlanPoint> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

/** Keyboard move: 0.1 m per arrow press, 0.5 m with Shift; `null` for any other key. */
export function nudgePosition(position: PlanPoint, key: string, isBigStep: boolean): PlanPoint | null {
  const direction = ARROWS[key];
  if (!direction) return null;
  const step = isBigStep ? BIG_STEP_M : SNAP_M;
  return {
    x: clampToRoom(round1(position.x + direction.x * step)),
    y: clampToRoom(round1(position.y + direction.y * step)),
  };
}

/** Client pixel -> snapped, clamped room metres, for an SVG drawn with `PLAN_VIEW_SIZE` square. */
export function pointerToRoom(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): PlanPoint {
  const toMetres = (offsetPx: number, sizePx: number) => {
    const units = (offsetPx / sizePx) * PLAN_VIEW_SIZE - PLAN_MARGIN;
    return clampToRoom(snapToGrid(units / PLAN_SCALE));
  };
  return { x: toMetres(clientX - rect.left, rect.width), y: toMetres(clientY - rect.top, rect.height) };
}

/** Footprint drawn when the row has no width/depth yet. */
export const DEFAULT_FOOTPRINT: Record<Exclude<LocationKind, "level">, { width: number; depth: number }> = {
  shelf: { width: 1.2, depth: 0.4 },
  box: { width: 0.4, depth: 0.3 },
  floor: { width: 0.8, depth: 0.8 },
  rug: { width: 1.6, depth: 1.2 },
};

export interface PlanItem {
  id: string;
  code: string;
  name: string;
  kind: LocationKind;
  x: number;
  y: number;
  width: number;
  depth: number;
  rotation: RotationDeg;
  /** Units stored here plus in its descendants (levels, boxes on it); `null` when unknown. */
  unitCount: number | null;
}

/** Units per location rolled up to each root, so a shelf shows what its levels hold. */
function rollUpCounts(locations: readonly WarehouseLocation[], unitCounts: Readonly<Record<string, number>>) {
  const byId = new Map(locations.map((location) => [location.id, location]));
  const totals = new Map<string, number>();
  for (const [locationId, count] of Object.entries(unitCounts)) {
    let current = byId.get(locationId);
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      totals.set(current.id, (totals.get(current.id) ?? 0) + count);
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }
  }
  return totals;
}

/** Active, positioned items that sit directly on the floor plan. */
export function planItems(
  locations: readonly WarehouseLocation[],
  unitCounts: Readonly<Record<string, number>> | null,
): PlanItem[] {
  const totals = unitCounts ? rollUpCounts(locations, unitCounts) : null;
  return locations
    .filter((location) => location.is_active && location.parent_id === null && location.kind !== "level")
    .filter((location) => location.pos_x !== null && location.pos_y !== null)
    .map((location) => {
      const fallback = DEFAULT_FOOTPRINT[location.kind as Exclude<LocationKind, "level">];
      return {
        id: location.id,
        code: location.code,
        name: location.name,
        kind: location.kind,
        x: location.pos_x as number,
        y: location.pos_y as number,
        width: location.width ?? fallback.width,
        depth: location.depth ?? fallback.depth,
        rotation: location.rotation_deg,
        unitCount: totals ? (totals.get(location.id) ?? 0) : null,
      };
    });
}

/** Where a new item lands: against its wall, centred along it. */
export function defaultPositionForWall(wall: Wall): PlanPoint {
  const half = WAREHOUSE_ROOM_SIZE_M / 2;
  const edge = 0.3;
  switch (wall) {
    case "N":
      return { x: half, y: edge };
    case "S":
      return { x: half, y: round1(WAREHOUSE_ROOM_SIZE_M - edge) };
    case "E":
      return { x: round1(WAREHOUSE_ROOM_SIZE_M - edge), y: half };
    case "W":
      return { x: edge, y: half };
    default:
      return { x: half, y: half };
  }
}

/** Shelves run along their wall: a quarter turn on the east and west walls. */
export function rotationForWall(wall: Wall): RotationDeg {
  return wall === "E" || wall === "W" ? 90 : 0;
}

export type NewLocationKind = Extract<LocationKind, "shelf" | "box" | "floor">;

const CODE_INFIX: Record<NewLocationKind, string> = { shelf: "E", box: "CJ", floor: "P" };

/** Next free code: N-E1, N-E2 for shelves; S-CJ1 for boxes; W-P1 for floor spots. */
export function suggestLocationCode(wall: Wall, kind: NewLocationKind, existingCodes: readonly string[]): string {
  const prefix = `${wall}-${CODE_INFIX[kind]}`;
  const taken = new Set(existingCodes.map((code) => normalizeLocationCode(code)));
  let index = 1;
  while (taken.has(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
}

export interface NewLocationForm {
  kind: NewLocationKind;
  wall: Wall;
  code: string;
  name: string;
  /** Shelves only: levels created under it right away. */
  levels: string;
}

export interface NewLocationDraft {
  code: string;
  name: string;
  kind: NewLocationKind;
  wall: Wall;
  parent_id: null;
  pos_x: number;
  pos_y: number;
  width: number;
  depth: number;
  rotation_deg: RotationDeg;
}

/** Validates the "Nueva ubicación" form; the server re-validates everything. */
export function buildLocationDraft(
  form: NewLocationForm,
): { ok: true; draft: NewLocationDraft; levels: number } | { ok: false; error: string } {
  const code = normalizeLocationCode(form.code);
  if (!LOCATION_CODE_PATTERN.test(code)) return { ok: false, error: LOCATION_ERRORS.CODE_FORMAT };
  const name = form.name.trim();
  if (!name || name.length > 80) return { ok: false, error: LOCATION_ERRORS.NAME_REQUIRED };

  let levels = 0;
  if (form.kind === "shelf") {
    const raw = form.levels.trim() || "0";
    levels = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
    if (!Number.isInteger(levels) || levels < 0 || levels > MAX_SHELF_LEVELS) {
      return { ok: false, error: `El número de niveles debe estar entre 0 y ${MAX_SHELF_LEVELS}` };
    }
  }

  const position = defaultPositionForWall(form.wall);
  const footprint = DEFAULT_FOOTPRINT[form.kind];
  return {
    ok: true,
    levels,
    draft: {
      code,
      name,
      kind: form.kind,
      wall: form.wall,
      parent_id: null,
      pos_x: position.x,
      pos_y: position.y,
      width: footprint.width,
      depth: footprint.depth,
      rotation_deg: rotationForWall(form.wall),
    },
  };
}

/** Level rows for a freshly created shelf: N-E1-N1 "Nivel 1", numbered from the floor up. */
export function buildShelfLevels(shelf: { id: string; code: string }, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    code: `${shelf.code}-N${index + 1}`,
    name: `Nivel ${index + 1}`,
    kind: "level" as const,
    parent_id: shelf.id,
    level_index: index + 1,
  }));
}

/** "1,0 m" — Chilean decimal comma, one decimal (the snap). */
export function formatMetres(value: number): string {
  return `${value.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m`;
}
