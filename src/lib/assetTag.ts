/**
 * Internal asset tag for serialised inventory.
 *
 * Format `MH-00001` (`^MH-[0-9]{5}$`, upper case), the identifier printed on the label roll BEFORE
 * the physical count. During the count the operator sticks a label on the unit, scans or types the
 * tag, and only then enters the manufacturer serial. The tag — not the serial — is what both the
 * QR code and the Code 128 barcode carry, so a phone camera and a keyboard-wedge gun resolve to the
 * same row. A tag is never reused: the database enforces it with a UNIQUE index
 * (`0009_asset_tags.sql`), and `nextAssetTag` only ever moves forward.
 *
 * Pure module, no I/O: the same rules run in the form (client), the service (server) and the label
 * sheet, and a scanned value and a typed value must converge on the same string everywhere.
 */

/** Mirrors the CHECK constraint on `serialised_assets.asset_tag`. Anchored, upper case only. */
export const ASSET_TAG_PATTERN = /^MH-[0-9]{5}$/;

/**
 * Operator-facing messages (Spanish, per convention). Defined here — not in the service — so the
 * API route can map them to status codes without importing the service module, which the route
 * tests replace wholesale with a mock.
 */
export const ASSET_TAG_FORMAT_ERROR = 'El asset tag no tiene el formato MH-00000';
export const ASSET_TAG_TAKEN_ERROR = 'El asset tag ya está asignado a otra unidad';

const TAG_PREFIX = 'MH-';
const TAG_DIGITS = 5;
const MIN_SEQUENCE = 1;
const MAX_SEQUENCE = 99999;

/** `1` → `MH-00001`. Throws outside `1..99999`: the roll cannot print a sixth digit. */
export function formatAssetTag(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < MIN_SEQUENCE || sequence > MAX_SEQUENCE) {
    throw new RangeError(`Asset tag sequence out of range (${MIN_SEQUENCE}..${MAX_SEQUENCE}): ${sequence}`);
  }
  return `${TAG_PREFIX}${String(sequence).padStart(TAG_DIGITS, '0')}`;
}

/**
 * Collapses what a scanner or a human produces into the canonical form: trimmed, upper-cased, and
 * without the trailing CR/LF a HID barcode gun appends as its "Enter". Does not add or remove
 * structure — `mh00007` stays invalid after normalisation.
 */
export function normalizeAssetTag(raw: string): string {
  return (raw ?? '').replace(/[\r\n]+$/, '').trim().toUpperCase();
}

/** True only for the canonical form. Normalise first; this deliberately rejects `mh-00001`. */
export function isValidAssetTag(value: string): boolean {
  return ASSET_TAG_PATTERN.test(value) && parseSequence(value) >= MIN_SEQUENCE;
}

/** `MH-00042` → `42`. Normalises on the way in; `null` for anything that is not a tag. */
export function parseAssetTag(value: string): number | null {
  const normalized = normalizeAssetTag(value);
  if (!isValidAssetTag(normalized)) return null;
  return parseSequence(normalized);
}

/**
 * The tag a new roll should start at, given the highest one already assigned. `null` means the
 * count has not started. Throws on a malformed input rather than guessing, and at `MH-99999`
 * rather than wrapping.
 */
export function nextAssetTag(current: string | null): string {
  if (current === null) return formatAssetTag(MIN_SEQUENCE);

  const sequence = parseAssetTag(current);
  if (sequence === null) {
    throw new Error(`Cannot derive the next asset tag from a malformed value: ${current}`);
  }
  return formatAssetTag(sequence + 1);
}

function parseSequence(tag: string): number {
  return Number.parseInt(tag.slice(TAG_PREFIX.length), 10);
}
