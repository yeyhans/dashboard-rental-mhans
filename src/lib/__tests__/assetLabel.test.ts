import { describe, expect, it } from 'vitest';

import { LABEL_MM, buildAssetLabel } from '../assetLabel';

/**
 * Label rendering for the pre-printed roll. Both symbologies carry the SAME string — the internal
 * asset tag, never the manufacturer serial — so a phone camera (QR) and a keyboard-wedge gun
 * (Code 128) resolve to the same row. The tests exercise the real encoder: a stubbed bwip-js
 * would pass with an unprintable label.
 */
describe('buildAssetLabel', () => {
  it('renders a QR code and a Code 128 barcode as inline SVG for a valid tag', () => {
    const label = buildAssetLabel({ tag: 'MH-00001', modelName: 'Profoto B10' });

    expect(label.qrSvg).toContain('<svg');
    expect(label.barcodeSvg).toContain('<svg');
    expect(label.tag).toBe('MH-00001');
    expect(label.modelName).toBe('Profoto B10');
  });

  it('normalises the tag before encoding so a scanned value prints the canonical string', () => {
    const label = buildAssetLabel({ tag: ' mh-00012\r\n', modelName: '' });

    expect(label.tag).toBe('MH-00012');
  });

  it('leaves the barcode without embedded text — the sheet prints the tag itself', () => {
    const label = buildAssetLabel({ tag: 'MH-00001', modelName: 'Profoto B10' });

    // bwip-js emits the human-readable line as a <text> element; its absence proves
    // `includetext` stayed off and the sheet controls the typography.
    expect(label.barcodeSvg).not.toContain('<text');
  });

  it('refuses a malformed tag rather than printing a label that can never be matched', () => {
    expect(() => buildAssetLabel({ tag: 'MH-1', modelName: 'Profoto B10' })).toThrow();
    expect(() => buildAssetLabel({ tag: '', modelName: 'Profoto B10' })).toThrow();
  });

  it('targets the Brother QL DK-11209 die-cut label (62 x 29 mm)', () => {
    expect(LABEL_MM).toEqual({ width: 62, height: 29 });
  });
});
