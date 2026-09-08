import { Printer } from 'lucide-react';

import { Button } from '../ui/button';
// Type-only from the encoder module (erased at build); the geometry comes from the
// dependency-free module so bwip-js stays out of the client bundle.
import type { AssetLabel } from '../../lib/assetLabel';
import { LABEL_MM } from '../../lib/labelGeometry';

interface AssetLabelSheetProps {
  labels: AssetLabel[];
  /** Short line above the grid: which roll or which reprint this is. */
  description: string;
}

/**
 * Printable sheet of asset labels (serialised inventory).
 *
 * One cell per label at the exact die-cut size (`LABEL_MM`, Brother QL DK-11209, 62 x 29 mm):
 * QR on the left for phone cameras, the tag and model name on the right, Code 128 along the
 * bottom of the right column for HID guns. Both codes carry the tag only.
 *
 * The SVGs come pre-rendered from `buildAssetLabel` on the server, so this island has no encoder
 * in its bundle; it hydrates only for the print button. On screen the cells are shown at true
 * size with a border so the operator can eyeball a roll before committing it; in print the
 * chrome is hidden, `@page` is set to the label size and every cell is its own page, which is
 * how a label printer expects a roll.
 */
export function AssetLabelSheet({ labels, description }: AssetLabelSheetProps) {
  return (
    <div className="space-y-4">
      <style>{printStyles}</style>

      <div className="asset-label-toolbar flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">{description}</p>
        <Button onClick={() => window.print()} disabled={labels.length === 0}>
          <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
          Imprimir
        </Button>
      </div>

      {labels.length === 0 ? (
        <div className="text-muted-foreground rounded-md border py-10 text-center text-sm">
          No hay etiquetas para mostrar.
        </div>
      ) : (
        <div className="asset-label-sheet flex flex-wrap gap-3">
          {labels.map((label) => (
            <article
              key={label.tag}
              className="asset-label bg-white text-black"
              aria-label={`Etiqueta ${label.tag}`}
            >
              <div
                className="asset-label-qr"
                // Trusted markup: produced by bwip-js from a validated tag, never from free text.
                dangerouslySetInnerHTML={{ __html: label.qrSvg }}
              />
              <div className="asset-label-body">
                <div className="asset-label-tag">{label.tag}</div>
                <div className="asset-label-model" title={label.modelName}>
                  {label.modelName || ' '}
                </div>
                <div
                  className="asset-label-barcode"
                  dangerouslySetInnerHTML={{ __html: label.barcodeSvg }}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// Millimetre geometry lives here, not in Tailwind: the sheet must match a physical die-cut, and
// utility classes round to rem. Print rules mirror the screen cell so what is previewed is what
// prints.
const printStyles = `
.asset-label {
  box-sizing: border-box;
  width: ${LABEL_MM.width}mm;
  height: ${LABEL_MM.height}mm;
  padding: 2mm;
  display: grid;
  grid-template-columns: 22mm 1fr;
  column-gap: 2mm;
  border: 0.2mm dashed #999999;
  border-radius: 1mm;
  overflow: hidden;
  page-break-inside: avoid;
  break-inside: avoid;
}
.asset-label-qr { display: flex; align-items: center; justify-content: center; }
.asset-label-qr svg { width: 22mm; height: 22mm; display: block; }
.asset-label-body { display: grid; grid-template-rows: auto auto 1fr; min-width: 0; }
.asset-label-tag {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 5.5mm;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.02em;
}
.asset-label-model {
  font-size: 2.8mm;
  line-height: 1.2;
  margin-top: 0.8mm;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.asset-label-barcode { display: flex; align-items: end; }
.asset-label-barcode svg { width: 100%; height: 9mm; display: block; }

@media print {
  @page { size: ${LABEL_MM.width}mm ${LABEL_MM.height}mm; margin: 0; }
  body * { visibility: hidden; }
  .asset-label-sheet, .asset-label-sheet * { visibility: visible; }
  .asset-label-sheet {
    position: absolute;
    left: 0;
    top: 0;
    margin: 0;
    gap: 0;
    display: block;
  }
  .asset-label { border: none; border-radius: 0; break-after: page; page-break-after: always; }
  .asset-label:last-child { break-after: auto; page-break-after: auto; }
}
`;

export default AssetLabelSheet;
