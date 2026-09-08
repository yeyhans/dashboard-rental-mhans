// The `bwip-js/node` subpath rather than the bare specifier: the package's root export maps only
// `browser` / `node` / `electron` / `react-native` conditions and no `default`, which Vite
// resolves but `moduleResolution: Bundler` (this tsconfig) does not — the bare import type-checks
// as TS2307 while building fine. This module only runs on the server (Astro SSR, vitest), so the
// node build is the correct one regardless.
import { code128, drawingSVG, qrcode } from 'bwip-js/node';

import { isValidAssetTag, normalizeAssetTag } from './assetTag';
import { LABEL_MM } from './labelGeometry';

export { LABEL_MM };

/**
 * Asset label rendering for the pre-printed roll (serialised inventory).
 *
 * One label carries the internal asset tag three ways: a QR code (phone cameras), a Code 128
 * barcode (HID keyboard-wedge guns) and the human-readable tag, plus the model name when the tag is
 * already assigned. Both symbologies encode the SAME string — the asset tag, never the
 * manufacturer serial — so any reader lands on the same row.
 *
 * bwip-js is imported through its per-symbology named exports rather than `toSVG()`, which links
 * every BWIPP encoder and defeats tree-shaking. `drawingSVG()` yields a self-contained `<svg>`
 * string that inlines into the sheet with no image request, so the print page has no network
 * dependency once it has loaded.
 *
 * Pure module: no DOM, no I/O. It renders in the Astro server pass and in a vitest process alike.
 * Server-only — never import it from a `client:*` island; the sheet gets pre-rendered SVG strings
 * as props and reads the geometry from `labelGeometry.ts`.
 */

export interface AssetLabelInput {
  tag: string;
  /** Empty for a roll pre-printed before the count: the model is not known yet. */
  modelName: string;
}

export interface AssetLabel {
  /** Inline `<svg>` markup. */
  qrSvg: string;
  /** Inline `<svg>` markup, without bwip-js's own text line — the sheet sets the type. */
  barcodeSvg: string;
  /** Canonical tag, after normalisation. */
  tag: string;
  modelName: string;
}

// QR module size in device pixels at the drawing's native scale. The sheet scales the SVG by its
// viewBox, so this only fixes the aspect and the quiet zone, not the printed size.
const QR_SCALE = 3;
// Bar height in points at the drawing's native scale; the sheet stretches it to the label width.
const BARCODE_HEIGHT = 10;

export function buildAssetLabel(input: AssetLabelInput): AssetLabel {
  const tag = normalizeAssetTag(input.tag);
  if (!isValidAssetTag(tag)) {
    throw new Error(`Cannot render a label for a malformed asset tag: ${JSON.stringify(input.tag)}`);
  }

  const qrSvg = qrcode({ bcid: 'qrcode', text: tag, scale: QR_SCALE }, drawingSVG());
  const barcodeSvg = code128(
    { bcid: 'code128', text: tag, height: BARCODE_HEIGHT, includetext: false },
    drawingSVG()
  );

  return { qrSvg, barcodeSvg, tag, modelName: input.modelName ?? '' };
}
