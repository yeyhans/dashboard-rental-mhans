import { UNIT_ERRORS, type UnitPatch } from "../../../lib/inventoryUnits";
import { MAX_LABELS_PER_SHEET } from "../labelSheet";
import type { InventoryUnit, UnitCondition, UnitWear } from "../../../types/inventory";
import type { UnitsApi } from "./unitsApi";

/** Conditions an admin may pick in the Estado select. "En arriendo" is derived; archive has its own action. */
export const EDITABLE_CONDITIONS = ["operational", "maintenance", "cleaning", "damaged", "blocked"] as const satisfies readonly UnitCondition[];

export type EditableCondition = (typeof EDITABLE_CONDITIONS)[number];

/** What an inline cell may change. */
export interface UnitChanges {
  serial_number?: string;
  wear?: UnitWear;
  condition?: EditableCondition;
  notes?: string;
}

const blankToNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

/**
 * The minimal patch for an inline edit, or `null` when the value did not really change (a blur
 * without typing must not spend a row_version).
 */
export function buildUnitPatch(
  unit: Pick<InventoryUnit, "serial_number" | "wear" | "condition" | "notes">,
  changes: UnitChanges,
): { ok: true; patch: UnitPatch } | { ok: false; error: string } | null {
  const patch: UnitPatch = {};

  if (changes.serial_number !== undefined) {
    const serial = changes.serial_number.trim();
    if (!serial) return { ok: false, error: UNIT_ERRORS.SERIAL_REQUIRED };
    if (serial !== unit.serial_number) patch.serial_number = serial;
  }
  if (changes.wear !== undefined && changes.wear !== unit.wear) patch.wear = changes.wear;
  if (changes.condition !== undefined && changes.condition !== unit.condition) patch.condition = changes.condition;
  if (changes.notes !== undefined) {
    const notes = blankToNull(changes.notes);
    if (notes !== (unit.notes ?? null)) patch.notes = notes;
  }

  return Object.keys(patch).length > 0 ? { ok: true, patch } : null;
}

export type SaveOutcome =
  | { kind: "saved"; unit: InventoryUnit }
  | { kind: "conflict"; message: string }
  | { kind: "error"; message: string }
  | { kind: "unchanged" };

/** One inline edit: patch with the row_version the row was read at; a 409 CONFLICT means reload. */
export async function saveUnitEdit(
  api: Pick<UnitsApi, "updateUnit">,
  unit: InventoryUnit,
  changes: UnitChanges,
): Promise<SaveOutcome> {
  const built = buildUnitPatch(unit, changes);
  if (built === null) return { kind: "unchanged" };
  if (!built.ok) return { kind: "error", message: built.error };

  const result = await api.updateUnit(unit, built.patch);
  if (result.ok) return { kind: "saved", unit: result.data };
  if (result.isConflict) return { kind: "conflict", message: result.error };
  return { kind: "error", message: result.error };
}

/** `/inventory/labels` filtered to these units' tags (the sheet caps at 200). */
export function buildLabelsHref(units: ReadonlyArray<Pick<InventoryUnit, "asset_tag">>): string {
  const tags = units.slice(0, MAX_LABELS_PER_SHEET).map((unit) => unit.asset_tag);
  return tags.length > 0 ? `/inventory/labels?tags=${tags.join(",")}` : "/inventory/labels";
}
