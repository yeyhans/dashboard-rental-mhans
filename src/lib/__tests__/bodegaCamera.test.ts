import { describe, expect, it } from 'vitest';

import { BARCODE_FORMATS, createBarcodeDetector, pickDetectedTag, supportsBarcodeDetector } from '../bodegaCamera';

describe('supportsBarcodeDetector', () => {
  it('is true only when the window exposes a BarcodeDetector constructor', () => {
    expect(supportsBarcodeDetector({ BarcodeDetector: class {} })).toBe(true);
    expect(supportsBarcodeDetector({})).toBe(false);
    expect(supportsBarcodeDetector({ BarcodeDetector: undefined })).toBe(false);
    expect(supportsBarcodeDetector({ BarcodeDetector: 'yes' })).toBe(false);
    expect(supportsBarcodeDetector(null)).toBe(false);
    expect(supportsBarcodeDetector(undefined)).toBe(false);
  });
});

describe('createBarcodeDetector', () => {
  it('requests both label symbologies', () => {
    let received: unknown;
    class Fake {
      constructor(options: unknown) {
        received = options;
      }
      detect() {
        return Promise.resolve([]);
      }
    }
    const detector = createBarcodeDetector({ BarcodeDetector: Fake });
    expect(detector).toBeInstanceOf(Fake);
    expect(received).toEqual({ formats: BARCODE_FORMATS });
    expect([...BARCODE_FORMATS]).toEqual(['qr_code', 'code_128']);
  });

  it('returns null when unsupported or when the constructor throws', () => {
    expect(createBarcodeDetector({})).toBeNull();
    class Throws {
      constructor() {
        throw new Error('unsupported formats');
      }
    }
    expect(createBarcodeDetector({ BarcodeDetector: Throws })).toBeNull();
  });
});

describe('pickDetectedTag', () => {
  it('returns the first well-formed tag, normalised', () => {
    expect(pickDetectedTag([{ rawValue: 'mh-00042\r\n' }])).toBe('MH-00042');
  });

  it('skips barcodes that are not asset tags', () => {
    expect(pickDetectedTag([{ rawValue: '4006381333931' }, { rawValue: 'MH-00007' }])).toBe('MH-00007');
  });

  it('is null when nothing on the frame is a tag', () => {
    expect(pickDetectedTag([])).toBeNull();
    expect(pickDetectedTag([{ rawValue: 'https://example.com' }])).toBeNull();
  });
});
