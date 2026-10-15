/**
 * Warehouse locations (`warehouse_locations`, migration 0021) — the pure validation.
 *
 * The room is about 5 x 5 m: shelves, boxes and loose items along the four walls and a rug in the
 * centre. Positions are metres from the room's origin and mark the CENTRE of an item's footprint
 * (the seeded rug sits at 2.5/2.5). The database enforces the hard rules with CHECKs and the
 * `warehouse_locations_validate_parent` trigger; this module repeats them so the operator reads a
 * Spanish sentence instead of a constraint name, and adds the soft checks (footprint outside the
 * room, overlapping items) the database does not make. Overlap is a warning, never a block.
 */

import {
  LOCATION_CODE_PATTERN,
  LOCATION_KINDS,
  ROTATIONS_DEG,
  WALLS,
  WAREHOUSE_ROOM_SIZE_M,
  type LocationKind,
  type RotationDeg,
  type Wall,
  type WarehouseLocation,
} from '../types/inventory';

export const LOCATION_ERRORS = {
  NOT_FOUND: 'La ubicación no existe',
  INACTIVE: 'La ubicación está desactivada',
  CONFLICT: 'La ubicación fue modificada por otra persona; recarga',
  ROW_VERSION_REQUIRED: 'Falta la versión de la ubicación; recarga la página',
  CODE_FORMAT: 'El código debe tener el formato muro-identificador, por ejemplo N-E1 o N-E1-N2 (muros N, E, S, W o C)',
  CODE_TAKEN: 'Ya existe una ubicación con ese código',
  NAME_REQUIRED: 'El nombre de la ubicación es obligatorio (máx. 80 caracteres)',
  KIND_INVALID: `Tipo de ubicación inválido. Debe ser uno de: ${LOCATION_KINDS.join(', ')}`,
  WALL_INVALID: `Muro inválido. Debe ser uno de: ${WALLS.join(', ')}`,
  POSITION_RANGE: `La posición debe estar entre 0 y ${WAREHOUSE_ROOM_SIZE_M} m`,
  SIZE_RANGE: `Las medidas deben ser mayores que 0 y de máximo ${WAREHOUSE_ROOM_SIZE_M} m`,
  ROTATION_INVALID: 'La rotación debe ser 0, 90, 180 o 270 grados',
  LEVEL_INDEX: 'El número de nivel debe ser un entero mayor o igual a 0',
  SELF_PARENT: 'Una ubicación no puede estar dentro de sí misma',
  ROOT_KIND_HAS_PARENT: 'Los estantes, áreas de piso y la alfombra no pueden estar dentro de otra ubicación',
  LEVEL_NEEDS_SHELF: 'Un nivel debe pertenecer a un estante',
  BOX_PARENT_KIND: 'Una caja solo puede ir en un estante, un nivel, el piso o la alfombra',
  PARENT_NOT_FOUND: 'La ubicación contenedora no existe',
  PARENT_INACTIVE: 'La ubicación contenedora está desactivada',
  RUG_UNIQUE: 'Ya existe una alfombra activa en la bodega',
  KIND_LOCKED: 'No puedes cambiar el tipo de una ubicación que contiene otras ubicaciones',
  HAS_CHILDREN: 'La ubicación contiene otras ubicaciones activas; desactívalas o muévelas primero',
  HAS_UNITS: 'La ubicación tiene unidades guardadas; muévelas antes de desactivarla',
  SAME_LOCATION: 'La unidad ya está en esa ubicación',
  TARGET_REQUIRED: 'Debes indicar la ubicación de destino',
  SOURCE_INVALID: 'Origen de la reubicación inválido',
  WARN_OUTSIDE_ROOM: 'La huella del elemento se sale de la bodega de 5 x 5 m',
  WARN_OVERLAP_PREFIX: 'Se superpone con',
} as const;

const NAME_MAX = 80;

/** Kinds that sit directly on the floor plan and never have a parent. */
const ROOT_KINDS: readonly LocationKind[] = ['shelf', 'floor', 'rug'];

/** Kinds a box may sit on. */
const BOX_PARENT_KINDS: readonly LocationKind[] = ['shelf', 'level', 'floor', 'rug'];

/** The writable columns of a location. */
export interface LocationDraft {
  code: string;
  name: string;
  kind: LocationKind;
  parent_id: string | null;
  wall: Wall | null;
  pos_x: number | null;
  pos_y: number | null;
  width: number | null;
  depth: number | null;
  height: number | null;
  level_index: number | null;
  rotation_deg: RotationDeg;
}

export type LocationValidation =
  | { ok: true; warnings: string[] }
  | { ok: false; error: string; status: 400 | 409 };

export function normalizeLocationCode(raw: string): string {
  return (raw ?? '').trim().toUpperCase();
}

/** The label the DB trigger writes into `serialised_assets.location`. */
export function describeLocation(location: { code: string; name: string }): string {
  return `${location.code} · ${location.name}`;
}

/** `null`/`''`/absent → null; numeric strings → numbers; garbage → NaN (validation rejects it). */
function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value.trim());
  return Number.NaN;
}

function toTextOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

const DRAFT_FIELDS: ReadonlyArray<keyof LocationDraft> = [
  'code',
  'name',
  'kind',
  'parent_id',
  'wall',
  'pos_x',
  'pos_y',
  'width',
  'depth',
  'height',
  'level_index',
  'rotation_deg',
];

/**
 * Builds a full draft from a request body. With `base` (an update), absent fields keep the stored
 * value, so a PUT may send only what changed. Does not validate; `validateLocation` does.
 */
export function parseLocationDraft(raw: unknown, base?: WarehouseLocation | null): LocationDraft {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const has = (field: keyof LocationDraft) => field in input;
  const pick = <K extends keyof LocationDraft>(field: K, parse: (value: unknown) => LocationDraft[K], fallback: LocationDraft[K]) =>
    has(field) ? parse(input[field]) : base ? (base[field] as LocationDraft[K]) : fallback;

  return {
    code: pick('code', (v) => normalizeLocationCode(typeof v === 'string' ? v : ''), ''),
    name: pick('name', (v) => (typeof v === 'string' ? v.trim() : ''), ''),
    kind: pick('kind', (v) => v as LocationKind, '' as LocationKind),
    parent_id: pick('parent_id', toTextOrNull, null),
    wall: pick('wall', (v) => (toTextOrNull(v)?.toUpperCase() ?? null) as Wall | null, null),
    pos_x: pick('pos_x', toNumberOrNull, null),
    pos_y: pick('pos_y', toNumberOrNull, null),
    width: pick('width', toNumberOrNull, null),
    depth: pick('depth', toNumberOrNull, null),
    height: pick('height', toNumberOrNull, null),
    level_index: pick('level_index', toNumberOrNull, null),
    rotation_deg: pick('rotation_deg', (v) => (toNumberOrNull(v) ?? 0) as RotationDeg, 0 as RotationDeg),
  };
}

/** True when `raw` names at least one writable location field. */
export function hasLocationFields(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  return DRAFT_FIELDS.some((field) => field in (raw as Record<string, unknown>));
}

const fail = (error: string, status: 400 | 409 = 400): LocationValidation => ({ ok: false, error, status });

function inRange(value: number | null, min: number, max: number): boolean {
  return value === null || (Number.isFinite(value) && value >= min && value <= max);
}

function validSize(value: number | null): boolean {
  return value === null || (Number.isFinite(value) && value > 0 && value <= WAREHOUSE_ROOM_SIZE_M);
}

interface Footprint {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Axis-aligned footprint, width/depth swapped for a quarter turn. Null without position and size. */
function footprint(item: Pick<LocationDraft, 'pos_x' | 'pos_y' | 'width' | 'depth' | 'rotation_deg'>): Footprint | null {
  if (item.pos_x === null || item.pos_y === null || item.width === null || item.depth === null) return null;
  const quarterTurn = item.rotation_deg === 90 || item.rotation_deg === 270;
  const spanX = quarterTurn ? item.depth : item.width;
  const spanY = quarterTurn ? item.width : item.depth;
  return {
    minX: item.pos_x - spanX / 2,
    maxX: item.pos_x + spanX / 2,
    minY: item.pos_y - spanY / 2,
    maxY: item.pos_y + spanY / 2,
  };
}

function overlaps(a: Footprint, b: Footprint): boolean {
  return a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
}

/**
 * Validates a full draft against every stored location (`all` must include inactive rows: the
 * code is unique across them). `selfId` is the row being updated, excluded from the uniqueness,
 * rug and overlap checks.
 */
export function validateLocation(draft: LocationDraft, ctx: { all: readonly WarehouseLocation[]; selfId?: string | null }): LocationValidation {
  const selfId = ctx.selfId ?? null;
  const others = ctx.all.filter((location) => location.id !== selfId);

  if (!LOCATION_CODE_PATTERN.test(draft.code)) return fail(LOCATION_ERRORS.CODE_FORMAT);
  const name = typeof draft.name === 'string' ? draft.name.trim() : '';
  if (!name || name.length > NAME_MAX) return fail(LOCATION_ERRORS.NAME_REQUIRED);
  if (!(LOCATION_KINDS as readonly string[]).includes(draft.kind)) return fail(LOCATION_ERRORS.KIND_INVALID);
  if (draft.wall !== null && !(WALLS as readonly string[]).includes(draft.wall)) return fail(LOCATION_ERRORS.WALL_INVALID);
  if (!inRange(draft.pos_x, 0, WAREHOUSE_ROOM_SIZE_M) || !inRange(draft.pos_y, 0, WAREHOUSE_ROOM_SIZE_M)) {
    return fail(LOCATION_ERRORS.POSITION_RANGE);
  }
  if (!validSize(draft.width) || !validSize(draft.depth) || !validSize(draft.height)) return fail(LOCATION_ERRORS.SIZE_RANGE);
  if (!(ROTATIONS_DEG as readonly number[]).includes(draft.rotation_deg)) return fail(LOCATION_ERRORS.ROTATION_INVALID);
  if (draft.level_index !== null && (!Number.isInteger(draft.level_index) || draft.level_index < 0)) {
    return fail(LOCATION_ERRORS.LEVEL_INDEX);
  }

  // Hierarchy (mirrors the table CHECKs and the validate_parent trigger).
  if (draft.parent_id !== null && draft.parent_id === selfId) return fail(LOCATION_ERRORS.SELF_PARENT);
  if (ROOT_KINDS.includes(draft.kind) && draft.parent_id !== null) return fail(LOCATION_ERRORS.ROOT_KIND_HAS_PARENT);
  if (draft.kind === 'level' && draft.parent_id === null) return fail(LOCATION_ERRORS.LEVEL_NEEDS_SHELF);
  if (draft.parent_id !== null) {
    const parent = ctx.all.find((location) => location.id === draft.parent_id);
    if (!parent) return fail(LOCATION_ERRORS.PARENT_NOT_FOUND);
    if (!parent.is_active) return fail(LOCATION_ERRORS.PARENT_INACTIVE);
    if (draft.kind === 'level' && parent.kind !== 'shelf') return fail(LOCATION_ERRORS.LEVEL_NEEDS_SHELF);
    if (draft.kind === 'box' && !BOX_PARENT_KINDS.includes(parent.kind)) return fail(LOCATION_ERRORS.BOX_PARENT_KIND);
  }

  if (selfId) {
    const current = ctx.all.find((location) => location.id === selfId);
    const hasChildren = ctx.all.some((location) => location.parent_id === selfId);
    if (current && current.kind !== draft.kind && hasChildren) return fail(LOCATION_ERRORS.KIND_LOCKED);
  }

  if (others.some((location) => normalizeLocationCode(location.code) === draft.code)) {
    return fail(LOCATION_ERRORS.CODE_TAKEN, 409);
  }
  if (draft.kind === 'rug' && others.some((location) => location.kind === 'rug' && location.is_active)) {
    return fail(LOCATION_ERRORS.RUG_UNIQUE, 409);
  }

  // Soft checks, only for items placed directly on the floor plan.
  const warnings: string[] = [];
  const own = draft.parent_id === null ? footprint(draft) : null;
  if (own) {
    const room = WAREHOUSE_ROOM_SIZE_M;
    if (own.minX < 0 || own.minY < 0 || own.maxX > room || own.maxY > room) warnings.push(LOCATION_ERRORS.WARN_OUTSIDE_ROOM);

    // The rug is the centre of the room: things are expected to sit on it or near it.
    if (draft.kind !== 'rug') {
      for (const other of others) {
        if (!other.is_active || other.parent_id !== null || other.kind === 'rug') continue;
        const theirs = footprint(other);
        if (theirs && overlaps(own, theirs)) warnings.push(`${LOCATION_ERRORS.WARN_OVERLAP_PREFIX} ${other.code}`);
      }
    }
  }

  return { ok: true, warnings };
}

export interface LocationTreeNode extends WarehouseLocation {
  children: LocationTreeNode[];
}

/**
 * Nests locations under their parents, siblings sorted by code. A row whose parent is not in the
 * input (filtered out as inactive, say) is promoted to the root rather than silently dropped.
 */
export function buildLocationTree(locations: readonly WarehouseLocation[]): LocationTreeNode[] {
  const nodes = new Map<string, LocationTreeNode>();
  for (const location of locations) nodes.set(location.id, { ...location, children: [] });

  const roots: LocationTreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parent_id ? nodes.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortRecursive = (list: LocationTreeNode[]) => {
    list.sort((a, b) => a.code.localeCompare(b.code));
    for (const node of list) sortRecursive(node.children);
  };
  sortRecursive(roots);
  return roots;
}
