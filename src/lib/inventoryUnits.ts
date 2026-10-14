/**
 * Units of a product (`serialised_assets`, migration 0021) — the pure rules.
 *
 * No I/O: the service applies these before writing, and the UI can run the same functions before a
 * round trip, so a rejected edit reads the same everywhere. "En arriendo" is derived from
 * `asset_current_state` (an open checkout), never stored — `deriveUnitStatus` is that derivation,
 * with the same precedence as the `product_unit_counts` view.
 */

import { formatAssetTag, nextAssetTag, parseAssetTag } from './assetTag';
import {
  UNIT_CONDITIONS,
  UNIT_WEARS,
  type UnitCondition,
  type UnitDisplayStatus,
  type UnitWear,
} from '../types/inventory';

/**
 * An error the operator can act on, with the HTTP status the API should answer. Anything thrown
 * that is NOT an `InventoryError` is an internal failure and becomes a generic 500.
 */
export class InventoryError extends Error {
  readonly status: 400 | 403 | 404 | 409;
  readonly code: string;

  constructor(message: string, status: 400 | 403 | 404 | 409, code?: string) {
    super(message);
    this.name = 'InventoryError';
    this.status = status;
    this.code = code ?? (status === 409 ? 'CONFLICT' : status === 404 ? 'NOT_FOUND' : 'VALIDATION');
  }
}

export const BULK_MAX_UNITS = 50;

const SERIAL_PREFIX_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,39}$/;

export const UNIT_ERRORS = {
  NOT_FOUND: 'La unidad no existe',
  CONFLICT: 'La unidad fue modificada por otra persona; recarga',
  INVALID_ID: 'ID de unidad inválido',
  ROW_VERSION_REQUIRED: 'Falta la versión de la unidad; recarga la página',
  INVALID_CONDITION: `Estado inválido. Debe ser uno de: ${UNIT_CONDITIONS.filter((c) => c !== 'retired').join(', ')}`,
  INVALID_WEAR: 'Condición inválida. Debe ser Nuevo o Usado',
  SERIAL_REQUIRED: 'El número de serie es obligatorio',
  SERIAL_TAKEN: 'Ya existe un equipo registrado con ese número de serie',
  EMPTY_PATCH: 'No hay cambios para guardar',
  USE_ARCHIVE: 'Para dar de baja una unidad usa la acción Archivar',
  IN_RENTAL: 'No puedes archivar una unidad que está en arriendo',
  ARCHIVED: 'La unidad está archivada',
  PRODUCT_INVALID: 'Debes seleccionar un producto válido',
  PRODUCT_NOT_FOUND: 'El producto indicado no existe',
  LOCATION_REQUIRED: 'La ubicación es obligatoria',
  BULK_COUNT: `La cantidad debe ser un número entero entre 1 y ${BULK_MAX_UNITS}`,
  SERIAL_PREFIX: 'El prefijo de serie solo admite letras, números, punto, guion y guion bajo (máx. 40)',
  BULK_SERIAL_TAKEN: 'Ya existen equipos con estos números de serie',
  TAG_RACE: 'Otra persona registró unidades al mismo tiempo; vuelve a intentarlo',
  TAGS_EXHAUSTED: 'No quedan asset tags disponibles para esa cantidad (máximo MH-99999)',
} as const;

/** What the unit list shows: "En arriendo" wins over the stored condition, except for archived units. */
export function deriveUnitStatus(condition: UnitCondition, hasOpenCheckout: boolean): UnitDisplayStatus {
  if (condition === 'retired') return 'retired';
  return hasOpenCheckout ? 'in_rental' : condition;
}

export function isValidRowVersion(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function isUnitCondition(value: unknown): value is UnitCondition {
  return typeof value === 'string' && (UNIT_CONDITIONS as readonly string[]).includes(value);
}

export function isUnitWear(value: unknown): value is UnitWear {
  return typeof value === 'string' && (UNIT_WEARS as readonly string[]).includes(value);
}

/**
 * The fields an edit may change. Location is NOT here: a move goes through
 * `AssetRelocationService.relocateAsset` so it leaves an `asset_relocations` row behind. The tag
 * and the product are identity and never change.
 */
export interface UnitPatch {
  serial_number?: string;
  condition?: Exclude<UnitCondition, 'retired'>;
  wear?: UnitWear;
  kit_code?: string | null;
  notes?: string | null;
}

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Throws a 400 `InventoryError` for an invalid condition (including `retired`). */
export function assertEditableCondition(value: unknown): asserts value is Exclude<UnitCondition, 'retired'> {
  if (value === 'retired') throw new InventoryError(UNIT_ERRORS.USE_ARCHIVE, 400);
  if (!isUnitCondition(value)) throw new InventoryError(UNIT_ERRORS.INVALID_CONDITION, 400);
}

/** Whitelists and normalises an edit. Throws a 400 `InventoryError` on any invalid field. */
export function sanitizeUnitPatch(raw: unknown): UnitPatch {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const patch: UnitPatch = {};

  if ('serial_number' in input) {
    const serial = typeof input.serial_number === 'string' ? input.serial_number.trim() : '';
    if (!serial) throw new InventoryError(UNIT_ERRORS.SERIAL_REQUIRED, 400);
    patch.serial_number = serial;
  }
  if ('condition' in input) {
    assertEditableCondition(input.condition);
    patch.condition = input.condition;
  }
  if ('wear' in input) {
    if (!isUnitWear(input.wear)) throw new InventoryError(UNIT_ERRORS.INVALID_WEAR, 400);
    patch.wear = input.wear;
  }
  if ('kit_code' in input) patch.kit_code = optionalText(input.kit_code);
  if ('notes' in input) patch.notes = optionalText(input.notes);

  if (Object.keys(patch).length === 0) throw new InventoryError(UNIT_ERRORS.EMPTY_PATCH, 400);
  return patch;
}

/** Trims and upper-cases a serial prefix; `null` when blank. Throws on a malformed prefix. */
export function normalizeSerialPrefix(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') throw new InventoryError(UNIT_ERRORS.SERIAL_PREFIX, 400);
  const prefix = raw.trim().toUpperCase();
  if (!prefix) return null;
  if (!SERIAL_PREFIX_PATTERN.test(prefix)) throw new InventoryError(UNIT_ERRORS.SERIAL_PREFIX, 400);
  return prefix;
}

export interface PlannedUnit {
  asset_tag: string;
  serial_number: string;
}

/**
 * Tags and serials for a bulk intake. Tags continue from the highest one assigned. With a prefix,
 * the serial is `PREFIX-<tag digits>` (unique because the tag is); without one it is the tag
 * itself, a placeholder the admin replaces with the manufacturer serial later — the column is
 * NOT NULL and unique, so it cannot be left empty.
 */
export function planBulkUnits(input: { highestTag: string | null; count: number; serialPrefix?: string | null }): PlannedUnit[] {
  const { highestTag, count } = input;
  if (!Number.isInteger(count) || count < 1 || count > BULK_MAX_UNITS) {
    throw new InventoryError(UNIT_ERRORS.BULK_COUNT, 400);
  }
  const prefix = normalizeSerialPrefix(input.serialPrefix);

  const first = parseAssetTag(nextAssetTag(highestTag)) as number;
  if (first + count - 1 > 99999) throw new InventoryError(UNIT_ERRORS.TAGS_EXHAUSTED, 409);

  return Array.from({ length: count }, (_, index) => {
    const tag = formatAssetTag(first + index);
    const digits = tag.slice('MH-'.length);
    return { asset_tag: tag, serial_number: prefix ? `${prefix}-${digits}` : tag };
  });
}

/** `lower(btrim(serial))`, the key of the unique index on `serialised_assets.serial_number`. */
export function serialKey(serial: string): string {
  return serial.trim().toLowerCase();
}
