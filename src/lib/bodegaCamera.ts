import { isValidAssetTag, normalizeAssetTag } from './assetTag';

/**
 * Camera scanning — only where the browser brings its own decoder.
 *
 * The garage's primary reader is a USB/Bluetooth gun in HID mode, which types into the input
 * like a keyboard. The camera is a fallback for a phone without a gun, and it is offered ONLY
 * when `window.BarcodeDetector` exists (Chrome/Android, Samsung Internet): no third-party decoder
 * is bundled, because the maintained ones are heavy and the unmaintained ones are a liability
 * (decision recorded 2026-09-08). Safari has no `BarcodeDetector`; on iOS the gun is the way.
 *
 * Both symbologies on the label are requested: the QR for phones, the Code 128 for guns — a
 * phone pointed at the label may lock onto either.
 */

export const BARCODE_FORMATS = ['qr_code', 'code_128'] as const;

/** Minimal `BarcodeDetector` surface, so this module needs no DOM lib types. */
export interface BarcodeDetectorLike {
  detect(source: unknown): Promise<ReadonlyArray<{ rawValue: string }>>;
}

export interface BarcodeDetectorConstructor {
  new (options?: { formats?: readonly string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<readonly string[]>;
}

/** `'BarcodeDetector' in window`, with the window injected so it is testable. */
export function supportsBarcodeDetector(win: object | null | undefined): win is { BarcodeDetector: BarcodeDetectorConstructor } {
  return !!win && 'BarcodeDetector' in win && typeof (win as { BarcodeDetector?: unknown }).BarcodeDetector === 'function';
}

export function createBarcodeDetector(win: object | null | undefined): BarcodeDetectorLike | null {
  if (!supportsBarcodeDetector(win)) return null;
  try {
    return new win.BarcodeDetector({ formats: BARCODE_FORMATS });
  } catch {
    return null;
  }
}

/**
 * The first detected value that is a well-formed asset tag, normalised. A frame may carry the
 * label's QR and its Code 128 at once (same tag) or a stray barcode on a box (not a tag).
 */
export function pickDetectedTag(results: ReadonlyArray<{ rawValue: string }>): string | null {
  for (const result of results) {
    const tag = normalizeAssetTag(result.rawValue);
    if (isValidAssetTag(tag)) return tag;
  }
  return null;
}
