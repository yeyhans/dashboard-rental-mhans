import { BULK_MAX_UNITS, InventoryError, UNIT_ERRORS, normalizeSerialPrefix } from "../../../lib/inventoryUnits";
import type { UnitWear } from "../../../types/inventory";
import type { EditableCondition } from "./unitEdits";
import type { BulkUnitsPayload } from "./unitsApi";

/** Raw values of the "Agregar unidad / Agregar varias" dialog (inputs hold strings). */
export interface BulkUnitsFormValues {
  count: string;
  wear: UnitWear;
  condition: EditableCondition;
  /** A warehouse location from the tree; wins over `location_text`. */
  location_id: string;
  /** Free-text fallback while the warehouse map is not set up. */
  location_text: string;
  serial_prefix: string;
}

export type BulkUnitsFormMode = "single" | "many";

export type BulkUnitsFormResult =
  | { ok: true; payload: BulkUnitsPayload }
  | { ok: false; errors: Partial<Record<keyof BulkUnitsFormValues, string>> };

/** Client-side mirror of the server rules (`planBulkUnits`, `normalizeSerialPrefix`), same messages. */
export function validateBulkUnitsForm(values: BulkUnitsFormValues, mode: BulkUnitsFormMode): BulkUnitsFormResult {
  const errors: Partial<Record<keyof BulkUnitsFormValues, string>> = {};

  let count = 1;
  if (mode === "many") {
    const raw = values.count.trim();
    count = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
    if (!Number.isInteger(count) || count < 1 || count > BULK_MAX_UNITS) errors.count = UNIT_ERRORS.BULK_COUNT;
  }

  const locationId = values.location_id.trim();
  const locationText = values.location_text.trim();
  if (!locationId && !locationText) errors.location_id = UNIT_ERRORS.LOCATION_REQUIRED;

  let prefix: string | null = null;
  try {
    prefix = normalizeSerialPrefix(values.serial_prefix);
  } catch (error) {
    errors.serial_prefix = error instanceof InventoryError ? error.message : UNIT_ERRORS.SERIAL_PREFIX;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    payload: {
      count,
      wear: values.wear,
      condition: values.condition,
      ...(locationId ? { location_id: locationId } : { location: locationText }),
      ...(prefix ? { serial_prefix: prefix } : {}),
    },
  };
}
