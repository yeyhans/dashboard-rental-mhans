import { describe, expect, it } from 'vitest';

import {
  ASSET_TAG_PATTERN,
  formatAssetTag,
  isValidAssetTag,
  nextAssetTag,
  normalizeAssetTag,
  parseAssetTag,
} from '../assetTag';

/**
 * Internal asset tag `MH-00001`. The label roll is printed BEFORE the physical count, so the tag
 * is the one identifier the operator never types from memory: it is scanned (phone camera or HID
 * barcode gun) or read off the sticker. Every rule here exists to make a scanned value and a typed
 * value converge on the same string.
 */
describe('asset tag format', () => {
  it('formats a sequence number as MH- plus five zero-padded digits', () => {
    expect(formatAssetTag(1)).toBe('MH-00001');
    expect(formatAssetTag(12)).toBe('MH-00012');
    expect(formatAssetTag(99999)).toBe('MH-99999');
  });

  it('refuses a sequence outside 1..99999 — the roll cannot print a six-digit tag', () => {
    expect(() => formatAssetTag(0)).toThrow();
    expect(() => formatAssetTag(100000)).toThrow();
    expect(() => formatAssetTag(-1)).toThrow();
    expect(() => formatAssetTag(1.5)).toThrow();
    expect(() => formatAssetTag(Number.NaN)).toThrow();
  });

  it('parses a well-formed tag back to its sequence number', () => {
    expect(parseAssetTag('MH-00001')).toBe(1);
    expect(parseAssetTag('MH-00120')).toBe(120);
    expect(parseAssetTag('MH-99999')).toBe(99999);
  });

  it('parses a scanned or lower-case tag after normalisation, not a malformed one', () => {
    expect(parseAssetTag('mh-00042\r\n')).toBe(42);
    expect(parseAssetTag('MH00042')).toBeNull();
    expect(parseAssetTag('MH-42')).toBeNull();
    expect(parseAssetTag('MH-000042')).toBeNull();
    expect(parseAssetTag('')).toBeNull();
    expect(parseAssetTag('MH-00000')).toBeNull();
  });

  it('exposes the pattern the database CHECK constraint enforces', () => {
    expect(ASSET_TAG_PATTERN.test('MH-00001')).toBe(true);
    expect(ASSET_TAG_PATTERN.test('mh-00001')).toBe(false);
    expect(ASSET_TAG_PATTERN.test('MH-0001')).toBe(false);
    expect(ASSET_TAG_PATTERN.test(' MH-00001')).toBe(false);
  });
});

describe('asset tag normalisation', () => {
  it('trims, upper-cases and strips the trailing Enter an HID scanner appends', () => {
    expect(normalizeAssetTag('  mh-00007 ')).toBe('MH-00007');
    expect(normalizeAssetTag('MH-00007\n')).toBe('MH-00007');
    expect(normalizeAssetTag('MH-00007\r\n')).toBe('MH-00007');
    expect(normalizeAssetTag('mh-00007\r')).toBe('MH-00007');
  });

  it('does not invent structure — a value without the dash stays invalid', () => {
    expect(normalizeAssetTag('mh00007')).toBe('MH00007');
    expect(isValidAssetTag(normalizeAssetTag('mh00007'))).toBe(false);
  });

  it('accepts a tag only after normalisation, so validation and storage agree', () => {
    expect(isValidAssetTag('MH-00007')).toBe(true);
    expect(isValidAssetTag('mh-00007')).toBe(false);
    expect(isValidAssetTag('MH-00007\n')).toBe(false);
    expect(isValidAssetTag('MH-00000')).toBe(false);
  });
});

describe('next asset tag', () => {
  it('starts the very first roll at MH-00001 when nothing has been assigned', () => {
    expect(nextAssetTag(null)).toBe('MH-00001');
  });

  it('continues from the highest assigned tag', () => {
    expect(nextAssetTag('MH-00041')).toBe('MH-00042');
    expect(nextAssetTag('MH-00999')).toBe('MH-01000');
  });

  it('refuses to roll past the last printable tag rather than wrapping to MH-00000', () => {
    expect(() => nextAssetTag('MH-99999')).toThrow();
  });

  it('refuses a malformed current tag instead of guessing a sequence', () => {
    expect(() => nextAssetTag('MH-41')).toThrow();
  });
});
