import { formatAssetTag, isValidAssetTag, normalizeAssetTag, parseAssetTag } from '../../lib/assetTag';

/**
 * Query-string contract of `/inventory/labels`, kept out of the Astro page so the bounds can be
 * unit-tested without rendering.
 *
 * Two ways to ask for labels:
 *   - `from` + `count`: a roll printed ahead of the count. Consecutive tags starting at `from`;
 *     the model name is unknown and left blank on the label.
 *   - `tags`: comma-separated existing tags to reprint (a damaged sticker, a unit registered
 *     before the roll existed). The page resolves each to its model name.
 *
 * Neither present: the page shows the small "from / count" form, pre-filled with the next free
 * tag. Any malformed input is an error, not a partial sheet — a roll with a hole in it is worse
 * than no roll, because the operator only notices at the unit that has no label.
 */

/** Upper bound per sheet. A DK-11209 roll holds 800 labels; 200 is a comfortable print job. */
export const MAX_LABELS_PER_SHEET = 200;

/** Last printable sequence — the roll cannot carry a sixth digit. */
const MAX_SEQUENCE = 99999;

export type LabelSheetMode = 'roll' | 'tags' | 'form' | 'error';

export interface LabelSheetRequest {
  mode: LabelSheetMode;
  /** Canonical tags to render; empty for `form` and `error`. */
  tags: string[];
  /** Operator-facing message, only for `error`. */
  error?: string;
}

export function resolveLabelSheetRequest(params: URLSearchParams): LabelSheetRequest {
  const tagsParam = params.get('tags');
  const fromParam = params.get('from');
  const countParam = params.get('count');

  if (tagsParam !== null) return resolveTagsList(tagsParam);
  if (fromParam !== null) return resolveRoll(fromParam, countParam);
  return { mode: 'form', tags: [] };
}

function resolveTagsList(raw: string): LabelSheetRequest {
  const entries = raw
    .split(',')
    .map((entry) => normalizeAssetTag(entry))
    .filter((entry) => entry.length > 0);

  const malformed = entries.find((entry) => !isValidAssetTag(entry));
  if (malformed !== undefined) {
    return {
      mode: 'error',
      tags: [],
      error: `El asset tag "${malformed}" no tiene el formato MH-00000`,
    };
  }

  // A reprint list built from a table selection can carry the same tag twice; print it once.
  const unique = Array.from(new Set(entries)).slice(0, MAX_LABELS_PER_SHEET);
  return { mode: 'tags', tags: unique };
}

function resolveRoll(fromRaw: string, countRaw: string | null): LabelSheetRequest {
  const start = parseAssetTag(fromRaw);
  if (start === null) {
    return {
      mode: 'error',
      tags: [],
      error: 'El asset tag inicial debe tener el formato MH-00000',
    };
  }

  const count = countRaw === null ? Number.NaN : Number.parseInt(countRaw, 10);
  if (!Number.isInteger(count) || count <= 0) {
    return {
      mode: 'error',
      tags: [],
      error: 'Indica cuántas etiquetas imprimir (un número entero mayor que cero)',
    };
  }

  // R3-003: a roll that runs past the last possible tag is an error, not a shorter roll — the
  // module's own "no partial sheets" rule. The 200 cap stays as it is: explicit, and shown.
  const end = start + Math.min(count, MAX_LABELS_PER_SHEET) - 1;
  if (end > MAX_SEQUENCE) {
    return {
      mode: 'error',
      tags: [],
      error: 'El rollo supera el último asset tag posible (MH-99999)',
    };
  }
  const tags: string[] = [];
  for (let sequence = start; sequence <= end; sequence += 1) {
    tags.push(formatAssetTag(sequence));
  }

  return { mode: 'roll', tags };
}
