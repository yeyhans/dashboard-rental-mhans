import { describe, expect, it } from 'vitest';

import { ASSET_TAG_PATTERN, formatAssetTag } from '../../../lib/assetTag';
import { LABEL_MM } from '../../../lib/labelGeometry';
import { ASSET_CONDITIONS, ASSET_CONDITION_LABELS } from '../../../types/inventory';
import { MAX_LABELS_PER_SHEET } from '../labelSheet';
import {
  GUIDE_ASSET_TAG_EXAMPLE,
  GUIDE_CONDITIONS,
  GUIDE_LABEL_SIZE,
  GUIDE_SECTIONS,
  GUIDE_VOCABULARY,
} from '../inventoryGuideContent';

describe('inventory guide content', () => {
  it('has the six sections in order, each with a title and a body', () => {
    expect(GUIDE_SECTIONS.map((section) => section.id)).toEqual([
      'vocabulary',
      'product-link',
      'configure-stock',
      'labels',
      'operator',
      'checklist',
    ]);
    for (const section of GUIDE_SECTIONS) {
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.table || section.groups.length > 0).toBeTruthy();
    }
  });

  it('uses an asset tag example that satisfies the real pattern', () => {
    expect(ASSET_TAG_PATTERN.test(GUIDE_ASSET_TAG_EXAMPLE)).toBe(true);
    expect(GUIDE_ASSET_TAG_EXAMPLE).toBe(formatAssetTag(1));
  });

  it('mirrors the real label size and sheet cap', () => {
    expect(GUIDE_LABEL_SIZE).toBe(`${LABEL_MM.width} x ${LABEL_MM.height} mm`);
    const text = JSON.stringify(GUIDE_SECTIONS);
    expect(text).toContain(String(MAX_LABELS_PER_SHEET));
  });

  it('covers every condition with the same Spanish label the app shows', () => {
    expect(GUIDE_CONDITIONS.map((entry) => entry.value)).toEqual([...ASSET_CONDITIONS]);
    for (const entry of GUIDE_CONDITIONS) {
      expect(entry.label).toBe(ASSET_CONDITION_LABELS[entry.value]);
    }
  });

  it('defines every vocabulary term once, with who creates it', () => {
    const terms = GUIDE_VOCABULARY.map((row) => row.term);
    expect(new Set(terms).size).toBe(terms.length);
    expect(terms).toEqual([
      'Producto / SKU',
      'Unidad (asset tag)',
      'Número de serie',
      'QR',
      'Código de barras (Code 128)',
      'Etiqueta',
      'Kit',
      'Ubicación',
      'Condición',
    ]);
    for (const row of GUIDE_VOCABULARY) {
      expect(row.what.length).toBeGreaterThan(0);
      expect(row.who.length).toBeGreaterThan(0);
    }
  });
});
