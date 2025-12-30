import { renderToBuffer } from '@react-pdf/renderer';
import type { ReactElement } from 'react';

export interface PdfGenerationOptions {
  document: ReactElement;
}

/**
 * Generate PDF buffer from React-PDF document
 * Replaces Puppeteer-based PDF generation
 */
export async function generatePdfBuffer(options: PdfGenerationOptions): Promise<Buffer> {
  try {
    console.log('🚀 Generating PDF with @react-pdf/renderer...');
    const startTime = Date.now();

    const pdfBuffer = await renderToBuffer(options.document);

    const endTime = Date.now();
    console.log(`✅ PDF generated successfully in ${endTime - startTime}ms, size: ${pdfBuffer.byteLength} bytes`);

    return pdfBuffer;
  } catch (error) {
    console.error('❌ Error generating PDF with React-PDF:', error);
    throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Backwards compatibility wrapper
 */
export async function generatePdfFromReactComponent(component: ReactElement): Promise<Buffer> {
  return generatePdfBuffer({ document: component });
}
