import { z } from 'zod';

import {
  ASSET_CONDITIONS,
  ASSET_CONDITION_LABELS,
  AUDITED_PRODUCT_FIELD_LABELS,
  type AssetCondition,
  type AuditedProductField,
  type SerialisedAssetInput,
} from '../../types/inventory';

export { ASSET_CONDITIONS, ASSET_CONDITION_LABELS };

/**
 * Intake form rules (M6, T-035), kept out of the component so they can be unit-tested without a
 * DOM and so the "do not validate the product" decision is visible in one place.
 *
 * The schema covers the asset's own fields only. It deliberately says nothing about the product's
 * `sku`, `brands`, `type`, `status` or `stock_status`: the physical count runs against a catalogue
 * where those are frequently missing, and gating entry on them would stall the count this feature
 * exists to unblock (`serialised-inventory-operations/spec.md`).
 */
export const intakeFormSchema = z.object({
  product_id: z.number().int().positive('Debes seleccionar un producto'),
  serial_number: z.string().trim().min(1, 'El número de serie es obligatorio'),
  condition: z.enum(ASSET_CONDITIONS),
  location: z.string().trim().min(1, 'La ubicación es obligatoria'),
  // Optional kit membership: a unit can belong to a kit, most do not.
  kit_code: z.string().optional(),
  notes: z.string().optional(),
});

export type IntakeFormValues = z.infer<typeof intakeFormSchema>;

/** Normalises form values into the API payload: trimmed, with blanks as explicit nulls. */
export function buildIntakePayload(values: IntakeFormValues): SerialisedAssetInput {
  const kitCode = (values.kit_code || '').trim();
  const notes = (values.notes || '').trim();

  return {
    product_id: values.product_id,
    serial_number: values.serial_number.trim(),
    condition: values.condition,
    location: values.location.trim(),
    kit_code: kitCode || null,
    notes: notes || null,
  };
}

export function conditionLabel(condition: AssetCondition): string {
  return ASSET_CONDITION_LABELS[condition];
}

/** Renders a product's missing fields for the data-quality list. */
export function describeMissingFields(fields: AuditedProductField[]): string {
  if (fields.length === 0) return '—';
  return fields.map((field) => AUDITED_PRODUCT_FIELD_LABELS[field]).join(', ');
}
