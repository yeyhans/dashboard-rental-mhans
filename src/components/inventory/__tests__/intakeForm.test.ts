import { describe, expect, it } from 'vitest';

import {
  ASSET_CONDITIONS,
  buildIntakePayload,
  conditionLabel,
  describeMissingFields,
  intakeFormSchema,
} from '../intakeForm';

/**
 * T-035. The form's rules live here rather than inside the component so they can be tested
 * without a DOM: the dashboard suite has no jsdom or testing-library, and adding either to prove
 * a five-field form works would cost more than it returns.
 */
describe('intake form validation', () => {
  const validEntry = {
    product_id: 42,
    serial_number: 'PROFOTO-B10-0007',
    condition: 'operational' as const,
    location: 'Bodega Purísima',
    kit_code: '',
    notes: '',
  };

  it('accepts an entry with no kit membership, since the kit is optional', () => {
    expect(intakeFormSchema.safeParse(validEntry).success).toBe(true);
  });

  it('demands a serial number — it is the only field that identifies the physical unit', () => {
    const result = intakeFormSchema.safeParse({ ...validEntry, serial_number: '  ' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('número de serie');
  });

  it('demands a location so a counted unit can be found again', () => {
    const result = intakeFormSchema.safeParse({ ...validEntry, location: '' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('ubicación');
  });

  it('demands a product, because an asset is one physical unit of a catalogue row', () => {
    const result = intakeFormSchema.safeParse({ ...validEntry, product_id: 0 });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('producto');
  });

  it('rejects a condition outside the rental vocabulary', () => {
    expect(intakeFormSchema.safeParse({ ...validEntry, condition: 'excelente' }).success).toBe(false);
  });

  it('never validates the product itself — an incomplete catalogue row must not block the count', () => {
    const fields = Object.keys(intakeFormSchema.shape);

    expect(fields).not.toContain('sku');
    expect(fields).not.toContain('brands');
    expect(fields).not.toContain('stock_status');
  });
});

describe('intake payload construction', () => {
  it('trims the serial and drops a blank kit rather than storing whitespace', () => {
    const payload = buildIntakePayload({
      product_id: 42,
      serial_number: '  PROFOTO-B10-0007 ',
      condition: 'operational',
      location: '  Bodega Purísima ',
      kit_code: '   ',
      notes: '',
    });

    expect(payload).toEqual({
      product_id: 42,
      serial_number: 'PROFOTO-B10-0007',
      condition: 'operational',
      location: 'Bodega Purísima',
      kit_code: null,
      notes: null,
    });
  });

  it('keeps a kit code that was actually entered', () => {
    const payload = buildIntakePayload({
      product_id: 42,
      serial_number: 'S-1',
      condition: 'maintenance',
      location: 'Taller',
      kit_code: ' KIT-LUZ-01 ',
      notes: ' Golpe en la montura ',
    });

    expect(payload.kit_code).toBe('KIT-LUZ-01');
    expect(payload.notes).toBe('Golpe en la montura');
  });
});

describe('display helpers', () => {
  it('labels every condition in Spanish', () => {
    for (const condition of ASSET_CONDITIONS) {
      expect(conditionLabel(condition)).toMatch(/\S/);
      expect(conditionLabel(condition)).not.toBe(condition);
    }
  });

  it('names the missing fields in Spanish for the data-quality list', () => {
    expect(describeMissingFields(['sku', 'brands'])).toBe('SKU, Marca');
    expect(describeMissingFields([])).toBe('—');
  });
});
