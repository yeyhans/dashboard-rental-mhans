import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('🧪 Test PDF download API called');
    
    const requestData = await request.json();
    const { order_id: orderId, type = 'budget' } = requestData;

    if (!orderId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'order_id es requerido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get HTML content first
    const baseUrl = new URL(request.url).origin;
    const htmlUrl = type === 'budget' 
      ? `${baseUrl}/budget-pdf/${orderId}`
      : `${baseUrl}/order-pdf/${orderId}`;
    
    console.log('🔗 Getting HTML from:', htmlUrl);
    
    const htmlResponse = await fetch(htmlUrl, {
      method: 'GET',
      headers: {
        'X-Internal-Request': 'true',
        'X-Requested-Order-Id': orderId.toString(),
        'Accept': 'text/html'
      }
    });

    if (!htmlResponse.ok) {
      console.error('❌ Failed to get HTML:', htmlResponse.status, htmlResponse.statusText);
      return new Response(JSON.stringify({
        success: false,
        message: 'Error al obtener HTML',
        error: `HTML generation failed: ${htmlResponse.status} ${htmlResponse.statusText}`
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const htmlContent = await htmlResponse.text();
    console.log('✅ HTML content loaded, size:', htmlContent.length);

    // Generate PDF using Puppeteer service
    console.log('🔄 Generating PDF with Puppeteer service...');
    
    const { generatePdfFromHtml } = await import('../../../lib/pdfService');
    
    const pdfBuffer = await generatePdfFromHtml({
      htmlContent,
      format: 'A4',
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
      printBackground: true
    });

    console.log('✅ PDF generated successfully, size:', pdfBuffer.byteLength);

    // Verify PDF content
    const pdfUint8Array = new Uint8Array(pdfBuffer);
    const pdfHeader = pdfUint8Array.slice(0, 4);
    const pdfHeaderString = String.fromCharCode(...pdfHeader);
    console.log('📄 PDF header check:', pdfHeaderString);
    
    if (!pdfHeaderString.startsWith('%PDF')) {
      console.error('❌ Invalid PDF content detected!');
      return new Response(JSON.stringify({
        success: false,
        message: 'PDF generado es inválido',
        error: 'Generated content is not a valid PDF'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Return PDF directly for download
    const fileName = `${type}_${orderId}_${Date.now()}.pdf`;
    
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('💥 Error in test PDF download API:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Error interno del servidor',
      error: error instanceof Error ? error.message : 'Error desconocido'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
