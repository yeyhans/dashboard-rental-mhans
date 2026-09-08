import { formatCLP } from './delivery';

/**
 * Product valuation rules behind the client's count spreadsheet ("Cantidad", "Valor Mercado",
 * "Valor Usado", "Valor Total"). Pure module: the same arithmetic feeds the data-quality report
 * on the server and the table in the browser, so the two can never disagree on a total.
 *
 * Three numbers are stored per product (`0010_product_valuation.sql`); the total is NOT. It is
 * derived here from the quantity the physical count actually found — falling back to the
 * quantity the client declares only while the count has not reached that model — times the used
 * value. A stored total would drift the moment a unit is counted or a value edited.
 */

/** The three persisted columns. `total_value_clp` is deliberately absent. */
export const VALUATION_FIELDS = ['declared_quantity', 'market_value_clp', 'used_value_clp'] as const;

export type ValuationField = (typeof VALUATION_FIELDS)[number];

export type ValuationUpdates = Partial<Record<ValuationField, number | null>>;

export const VALUATION_FIELD_ERROR = 'El valor debe ser un número entero mayor o igual a 0';

export type QuantityDiscrepancy = 'match' | 'missing_units' | 'extra_units' | 'undeclared';

/** Operator-facing wording, per row of the data-quality table. */
export const DISCREPANCY_LABELS: Record<QuantityDiscrepancy, string> = {
  match: 'Coincide',
  missing_units: 'Faltan unidades',
  extra_units: 'Sobran unidades',
  undeclared: 'Sin declarar',
};

/**
 * Muted Área 01 status tones (`--color-ok` / `--color-warn` / `--color-info` / `--color-neutral`
 * in `globals.css`). No `crit`: a count mismatch is something to reconcile, not an incident.
 */
export type StatusTone = 'ok' | 'warn' | 'info' | 'neutral';

export const DISCREPANCY_TONES: Record<QuantityDiscrepancy, StatusTone> = {
  match: 'ok',
  missing_units: 'warn',
  extra_units: 'info',
  undeclared: 'neutral',
};

export interface QuantityInput {
  /** `count(serialised_assets)` for the product. Never null: zero means not yet counted. */
  countedQuantity: number;
  /** The client's "Cantidad". Null until entered. */
  declaredQuantity: number | null;
}

export interface TotalValueInput extends QuantityInput {
  usedValueClp: number | null;
}

/**
 * "Valor Total (CLP)". Counted units win once any exist; before that the declaration stands in.
 * Null — not zero — when either factor is unknown, so an unvalued row never reads as worthless.
 */
export function totalValueClp(input: TotalValueInput): number | null {
  const quantity =
    input.countedQuantity > 0 ? input.countedQuantity : input.declaredQuantity;
  if (quantity === null || input.usedValueClp === null) return null;
  return quantity * input.usedValueClp;
}

export function quantityDiscrepancy(input: QuantityInput): QuantityDiscrepancy {
  if (input.declaredQuantity === null) return 'undeclared';
  if (input.countedQuantity === input.declaredQuantity) return 'match';
  return input.countedQuantity < input.declaredQuantity ? 'missing_units' : 'extra_units';
}

/** `$1.234.567`, es-CL, no decimals. Reuses the formatter the delivery board already ships. */
export const formatClp = formatCLP;

/**
 * Server-side validation of the three fields as they arrive in a product update. Only keys that
 * are PRESENT are considered, so a partial update leaves the others untouched. A blank string
 * (an emptied form input) and an explicit null both mean "clear the value". Anything that is not
 * a non-negative integer — negatives, decimals, text — is refused as a whole with the Spanish
 * message; the response carries no partial write.
 */
export function parseValuationUpdates(body: Record<string, unknown>): {
  values: ValuationUpdates;
  error: string | null;
} {
  const values: ValuationUpdates = {};

  for (const field of VALUATION_FIELDS) {
    if (!(field in body)) continue;
    const parsed = parseNonNegativeInteger(body[field]);
    if (parsed === undefined) {
      return { values: {}, error: VALUATION_FIELD_ERROR };
    }
    values[field] = parsed;
  }

  return { values, error: null };
}

/** `null` = clear; `undefined` = invalid. */
function parseNonNegativeInteger(raw: unknown): number | null | undefined {
  if (raw === null) return null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    // Digits only: `Number('1e3')` would happily accept scientific notation from a typo.
    if (!/^\d+$/.test(trimmed)) return undefined;
    return Number.parseInt(trimmed, 10);
  }
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0) return raw;
  return undefined;
}
