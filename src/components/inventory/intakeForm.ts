import { z } from 'zod';

import { ASSET_TAG_FORMAT_ERROR, isValidAssetTag, normalizeAssetTag } from '../../lib/assetTag';
import {
  ASSET_CONDITIONS,
  ASSET_CONDITION_LABELS,
  AUDITED_PRODUCT_FIELD_LABELS,
  type AssetCondition,
  type AuditedProductField,
  type SerialisedAssetInput,
} from '../../types/inventory';

export { ASSET_CONDITIONS, ASSET_CONDITION_LABELS };

export const ASSET_TAG_REQUIRED_MESSAGE = 'Escanea o escribe el asset tag de la etiqueta';

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
  // First field, filled by a scanner more often than by hand. Normalised BEFORE the format check
  // so a lower-case read or the trailing Enter a HID gun appends never surfaces as a format error;
  // the transformed value is what the payload sends and what the CHECK constraint sees.
  asset_tag: z
    .string()
    .transform(normalizeAssetTag)
    .refine((tag) => tag.length > 0, ASSET_TAG_REQUIRED_MESSAGE)
    // Same string the service throws (R2-001): one message, one place — `lib/assetTag.ts`.
    .refine((tag) => tag.length === 0 || isValidAssetTag(tag), ASSET_TAG_FORMAT_ERROR),
  serial_number: z.string().trim().min(1, 'El número de serie es obligatorio'),
  condition: z.enum(ASSET_CONDITIONS),
  location: z.string().trim().min(1, 'La ubicación es obligatoria'),
  // Optional kit membership: a unit can belong to a kit, most do not.
  kit_code: z.string().optional(),
  notes: z.string().optional(),
});

export type IntakeFormValues = z.infer<typeof intakeFormSchema>;

/**
 * Scanner-input decisions (R3-001), framework-free so they are tested here and CALLED by
 * `SerialisedAssetForm` rather than re-implemented inline. The suite has no jsdom; the component
 * stays a thin shell over these.
 */

/** A HID gun terminates its read with Enter. That Enter moves to the serial — it does not submit. */
export function isScannerSubmitKey(event: { key: string }): boolean {
  return event.key === 'Enter';
}

/** Canonical form for the tag field as soon as it is left or terminated. */
export function normaliseTagField(value: string | null | undefined): string {
  return normalizeAssetTag(value ?? '');
}

/**
 * The form after a successful save. A count runs unit after unit in the same place: product,
 * condition, location and kit stay; tag, serial and notes are per unit and start blank.
 */
export function valuesAfterSubmit(values: IntakeFormValues): IntakeFormValues {
  return {
    product_id: values.product_id,
    asset_tag: '',
    serial_number: '',
    condition: values.condition,
    location: values.location,
    kit_code: values.kit_code,
    notes: '',
  };
}

/** Normalises form values into the API payload: trimmed, with blanks as explicit nulls. */
export function buildIntakePayload(values: IntakeFormValues): SerialisedAssetInput {
  const kitCode = (values.kit_code || '').trim();
  const notes = (values.notes || '').trim();

  return {
    product_id: values.product_id,
    // Already canonical after the resolver; normalised again so a caller that skipped it (or a
    // stale form state) cannot send a value the service would reject.
    asset_tag: normalizeAssetTag(values.asset_tag),
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
