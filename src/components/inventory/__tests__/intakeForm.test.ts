import { describe, expect, it } from 'vitest';

import {
  ASSET_CONDITIONS,
  buildIntakePayload,
  conditionLabel,
  describeMissingFields,
  intakeFormSchema,
  isScannerSubmitKey,
  normaliseTagField,
  valuesAfterSubmit,
} from '../intakeForm';

/**
 * T-035. The form's rules live here rather than inside the component so they can be tested
 * without a DOM: the dashboard suite has no jsdom or testing-library, and adding either to prove
 * a five-field form works would cost more than it returns.
 */
describe('intake form validation', () => {
  const validEntry = {
    product_id: 42,
    asset_tag: 'MH-00007',
    serial_number: 'PROFOTO-B10-0007',
    condition: 'operational' as const,
    location: 'Bodega Purísima',
    kit_code: '',
    notes: '',
  };

  it('accepts an entry with no kit membership, since the kit is optional', () => {
    expect(intakeFormSchema.safeParse(validEntry).success).toBe(true);
  });

  // The tag is scanned off a pre-printed label (phone camera or HID gun), so the schema must
  // accept what a scanner emits and refuse what no label could carry.
  it('demands an asset tag — the label is what the count is driven by', () => {
    const result = intakeFormSchema.safeParse({ ...validEntry, asset_tag: '' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Escanea o escribe el asset tag de la etiqueta');
  });

  it('normalises a scanned tag (lower case, trailing Enter) into the canonical form', () => {
    const result = intakeFormSchema.safeParse({ ...validEntry, asset_tag: ' mh-00007\r\n' });

    expect(result.success).toBe(true);
    expect(result.data?.asset_tag).toBe('MH-00007');
  });

  it('rejects a tag that does not match MH-00000 with a Spanish message', () => {
    const result = intakeFormSchema.safeParse({ ...validEntry, asset_tag: 'MH-7' });

    expect(result.success).toBe(false);
    // R2-001: the same string the service throws — `ASSET_TAG_FORMAT_ERROR` in `lib/assetTag.ts`.
    expect(result.error?.issues[0]?.message).toBe('El asset tag no tiene el formato MH-00000');
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
      asset_tag: 'MH-00007',
      serial_number: '  PROFOTO-B10-0007 ',
      condition: 'operational',
      location: '  Bodega Purísima ',
      kit_code: '   ',
      notes: '',
    });

    expect(payload).toEqual({
      product_id: 42,
      asset_tag: 'MH-00007',
      serial_number: 'PROFOTO-B10-0007',
      condition: 'operational',
      location: 'Bodega Purísima',
      kit_code: null,
      notes: null,
    });
  });

  it('sends the canonical tag even if the value bypassed the resolver', () => {
    const payload = buildIntakePayload({
      product_id: 42,
      asset_tag: 'mh-00007\n',
      serial_number: 'S-1',
      condition: 'operational',
      location: 'Bodega',
      kit_code: '',
      notes: '',
    });

    expect(payload.asset_tag).toBe('MH-00007');
  });

  it('keeps a kit code that was actually entered', () => {
    const payload = buildIntakePayload({
      product_id: 42,
      asset_tag: 'MH-00001',
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

/**
 * R3-001: the scanner-input behaviour of `SerialisedAssetForm` (Enter-to-serial, blur-normalise,
 * post-submit reset) as pure decisions. The component calls these; the suite has no jsdom.
 */
describe('scanner input helpers', () => {
  it('isScannerSubmitKey recognises only Enter — the gun terminator', () => {
    expect(isScannerSubmitKey({ key: 'Enter' })).toBe(true);
    expect(isScannerSubmitKey({ key: 'Tab' })).toBe(false);
    expect(isScannerSubmitKey({ key: ' ' })).toBe(false);
  });

  it('normaliseTagField canonicalises a raw read and tolerates an empty field', () => {
    expect(normaliseTagField('mh-00042\r\n')).toBe('MH-00042');
    expect(normaliseTagField('  MH-00001 ')).toBe('MH-00001');
    expect(normaliseTagField(undefined)).toBe('');
    expect(normaliseTagField(null)).toBe('');
  });

  it('valuesAfterSubmit clears the per-unit fields and keeps the per-station ones', () => {
    const next = valuesAfterSubmit({
      product_id: 42,
      asset_tag: 'MH-00001',
      serial_number: 'SN-1',
      condition: 'maintenance',
      location: 'Estante B',
      kit_code: 'KIT-7',
      notes: 'rayón leve',
    });
    expect(next).toEqual({
      product_id: 42,
      asset_tag: '',
      serial_number: '',
      condition: 'maintenance',
      location: 'Estante B',
      kit_code: 'KIT-7',
      notes: '',
    });
  });
});
