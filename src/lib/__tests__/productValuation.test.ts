import { describe, expect, it } from 'vitest';

import {
  DISCREPANCY_LABELS,
  DISCREPANCY_TONES,
  VALUATION_FIELDS,
  VALUATION_FIELD_ERROR,
  formatClp,
  parseValuationUpdates,
  quantityDiscrepancy,
  totalValueClp,
} from '../productValuation';

/**
 * The client's spreadsheet has five columns per product: Cantidad, Numero serie, Valor Mercado,
 * Valor Usado, Valor Total. "Numero serie" is the model code (`products.sku`), the two values are
 * stored per product, and "Valor Total" is NEVER stored — it is derived here from the quantity
 * the count actually found (or, before the count reaches that model, the quantity the client
 * declares) times the used value.
 */
describe('totalValueClp', () => {
  it('multiplies the counted quantity by the used value once units have been counted', () => {
    expect(totalValueClp({ countedQuantity: 3, declaredQuantity: 5, usedValueClp: 100000 })).toBe(300000);
  });

  it('falls back to the declared quantity before the count reaches the model', () => {
    expect(totalValueClp({ countedQuantity: 0, declaredQuantity: 5, usedValueClp: 100000 })).toBe(500000);
  });

  it('is null when there is no quantity at all — nothing counted, nothing declared', () => {
    expect(totalValueClp({ countedQuantity: 0, declaredQuantity: null, usedValueClp: 100000 })).toBeNull();
  });

  it('is null when the used value is unknown, rather than pretending it is zero', () => {
    expect(totalValueClp({ countedQuantity: 3, declaredQuantity: 3, usedValueClp: null })).toBeNull();
  });

  it('is zero, not null, when the quantity is known and the used value is zero', () => {
    expect(totalValueClp({ countedQuantity: 2, declaredQuantity: 2, usedValueClp: 0 })).toBe(0);
  });
});

describe('quantityDiscrepancy', () => {
  it('reports undeclared when the client has not stated a quantity, whatever was counted', () => {
    expect(quantityDiscrepancy({ countedQuantity: 0, declaredQuantity: null })).toBe('undeclared');
    expect(quantityDiscrepancy({ countedQuantity: 4, declaredQuantity: null })).toBe('undeclared');
  });

  it('reports a match when the count equals the declaration', () => {
    expect(quantityDiscrepancy({ countedQuantity: 5, declaredQuantity: 5 })).toBe('match');
    expect(quantityDiscrepancy({ countedQuantity: 0, declaredQuantity: 0 })).toBe('match');
  });

  it('reports missing units when fewer were counted than declared', () => {
    expect(quantityDiscrepancy({ countedQuantity: 3, declaredQuantity: 5 })).toBe('missing_units');
  });

  it('reports extra units when more were counted than declared', () => {
    expect(quantityDiscrepancy({ countedQuantity: 6, declaredQuantity: 5 })).toBe('extra_units');
  });
});

describe('discrepancy presentation', () => {
  it('labels every discrepancy in Spanish with the wording the client reads', () => {
    expect(DISCREPANCY_LABELS).toEqual({
      match: 'Coincide',
      missing_units: 'Faltan unidades',
      extra_units: 'Sobran unidades',
      undeclared: 'Sin declarar',
    });
  });

  it('maps each discrepancy to one of the muted Área 01 status tones — no new colours', () => {
    const allowed = new Set(['ok', 'warn', 'info', 'neutral']);
    for (const tone of Object.values(DISCREPANCY_TONES)) {
      expect(allowed.has(tone)).toBe(true);
    }
    expect(DISCREPANCY_TONES.match).toBe('ok');
    expect(DISCREPANCY_TONES.missing_units).toBe('warn');
  });
});

describe('formatClp', () => {
  it('formats with es-CL thousands separators and no decimals', () => {
    expect(formatClp(1234567)).toBe('$1.234.567');
    expect(formatClp(0)).toBe('$0');
  });
});

describe('parseValuationUpdates', () => {
  it('names the three stored columns and nothing else — the total is never persisted', () => {
    expect(VALUATION_FIELDS).toEqual(['declared_quantity', 'market_value_clp', 'used_value_clp']);
    expect(VALUATION_FIELDS).not.toContain('total_value_clp');
  });

  it('passes through integers >= 0 and ignores keys that are not present', () => {
    const result = parseValuationUpdates({ declared_quantity: 5, market_value_clp: 0, name: 'x' });

    expect(result).toEqual({ error: null, values: { declared_quantity: 5, market_value_clp: 0 } });
  });

  it('accepts numeric strings from a form and empty strings as "clear the value"', () => {
    const result = parseValuationUpdates({ used_value_clp: '150000', declared_quantity: '' });

    expect(result).toEqual({ error: null, values: { used_value_clp: 150000, declared_quantity: null } });
  });

  it('accepts an explicit null to clear a value', () => {
    expect(parseValuationUpdates({ market_value_clp: null })).toEqual({
      error: null,
      values: { market_value_clp: null },
    });
  });

  it('rejects negatives, decimals and non-numbers with the Spanish message', () => {
    for (const bad of [-1, 1.5, 'abc', true, Number.NaN, '1e3x']) {
      const result = parseValuationUpdates({ declared_quantity: bad });
      expect(result.error).toBe(VALUATION_FIELD_ERROR);
      expect(result.values).toEqual({});
    }
    expect(VALUATION_FIELD_ERROR).toBe('El valor debe ser un número entero mayor o igual a 0');
  });

  it('returns no values and no error when none of the fields is present', () => {
    expect(parseValuationUpdates({ name: 'Profoto' })).toEqual({ error: null, values: {} });
  });
});
