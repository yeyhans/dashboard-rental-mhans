import { describe, expect, it } from 'vitest';

import { MAX_LABELS_PER_SHEET, resolveLabelSheetRequest } from '../labelSheet';

/**
 * Query-string contract of `/inventory/labels`. Two modes: a roll printed ahead of the count
 * (`from` + `count`, model unknown) or reprints for units already registered (`tags`). Kept out of
 * the Astro page so the bounds can be tested without rendering.
 */
describe('resolveLabelSheetRequest', () => {
  it('expands from + count into a consecutive run of tags', () => {
    const request = resolveLabelSheetRequest(new URLSearchParams('from=MH-00041&count=3'));

    expect(request).toEqual({ mode: 'roll', tags: ['MH-00041', 'MH-00042', 'MH-00043'] });
  });

  it('accepts a scanned or lower-case from, since it is often read off the last label', () => {
    const request = resolveLabelSheetRequest(new URLSearchParams('from=mh-00041&count=1'));

    expect(request).toEqual({ mode: 'roll', tags: ['MH-00041'] });
  });

  it('caps a roll at the sheet maximum instead of rendering an unbounded page', () => {
    const request = resolveLabelSheetRequest(new URLSearchParams('from=MH-00001&count=99999'));

    expect(request.mode).toBe('roll');
    expect(request.tags).toHaveLength(MAX_LABELS_PER_SHEET);
    expect(request.tags[0]).toBe('MH-00001');
  });

  // R3-003: no partial sheets — a roll past the last tag is refused, not truncated.
  it('refuses a roll that would run past MH-99999 instead of truncating it', () => {
    const request = resolveLabelSheetRequest(new URLSearchParams('from=MH-99998&count=10'));

    expect(request.mode).toBe('error');
    expect(request.tags).toEqual([]);
    expect(request.error).toBe('El rollo supera el último asset tag posible (MH-99999)');
  });

  it('still prints a roll that ends exactly on MH-99999', () => {
    const request = resolveLabelSheetRequest(new URLSearchParams('from=MH-99998&count=2'));

    expect(request.mode).toBe('roll');
    expect(request.tags).toEqual(['MH-99998', 'MH-99999']);
  });

  it('treats a missing or non-positive count as an error, not as a default roll', () => {
    expect(resolveLabelSheetRequest(new URLSearchParams('from=MH-00001')).mode).toBe('error');
    expect(resolveLabelSheetRequest(new URLSearchParams('from=MH-00001&count=0')).mode).toBe('error');
    expect(resolveLabelSheetRequest(new URLSearchParams('from=MH-00001&count=tres')).mode).toBe('error');
  });

  it('rejects a malformed from with a Spanish message', () => {
    const request = resolveLabelSheetRequest(new URLSearchParams('from=MH-1&count=3'));

    expect(request.mode).toBe('error');
    expect(request.error).toContain('MH-00000');
  });

  it('parses a comma-separated tags list for reprints, dropping blanks and duplicates', () => {
    const request = resolveLabelSheetRequest(new URLSearchParams('tags=MH-00012,%20mh-00013%20,,MH-00012'));

    expect(request).toEqual({ mode: 'tags', tags: ['MH-00012', 'MH-00013'] });
  });

  it('rejects a tags list containing a malformed entry rather than printing part of it', () => {
    const request = resolveLabelSheetRequest(new URLSearchParams('tags=MH-00012,MH-13'));

    expect(request.mode).toBe('error');
    expect(request.error).toContain('MH-13');
  });

  it('caps a reprint list at the sheet maximum too', () => {
    const tags = Array.from({ length: MAX_LABELS_PER_SHEET + 5 }, (_, index) =>
      `MH-${String(index + 1).padStart(5, '0')}`
    );
    const request = resolveLabelSheetRequest(new URLSearchParams({ tags: tags.join(',') }));

    expect(request.tags).toHaveLength(MAX_LABELS_PER_SHEET);
  });

  it('asks for input when neither mode is requested', () => {
    expect(resolveLabelSheetRequest(new URLSearchParams(''))).toEqual({ mode: 'form', tags: [] });
  });

  it('prefers the explicit tags list when both modes are present', () => {
    const request = resolveLabelSheetRequest(new URLSearchParams('tags=MH-00005&from=MH-00001&count=3'));

    expect(request).toEqual({ mode: 'tags', tags: ['MH-00005'] });
  });
});
