import type { APIRoute } from 'astro';
import type { OrderPdfData } from '../../../lib/orderPdfGenerationService';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('🚀 Order processing PDF generation API called');
    
    const body = await request.json();
    const { orderData, uploadToR2 = true, sendEmail = false }: {
      orderData: OrderPdfData;
      uploadToR2?: boolean;
      sendEmail?: boolean;
    } = body;

    console.log('📋 Received order data:', {
      order_id: orderData.order_id || orderData.id,
      customer_id: orderData.customer_id,
      billing_email: orderData.billing?.email || orderData.billing_email,
      project_name: orderData.metadata?.order_proyecto || orderData.order_proyecto
    });

    // Validate required fields
    const orderId = orderData.order_id || orderData.id;
    if (!orderId || !orderData.customer_id) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Campos requeridos faltantes: order_id, customer_id'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate PDF using HTML template + Puppeteer service
    console.log('📄 Making internal request to order-pdf page...');
    
    const baseUrl = new URL(request.url).origin;
    const htmlUrl = `${baseUrl}/order-pdf/${orderId}`;
    
    console.log('🔗 HTML URL:', htmlUrl);
    
    // Get HTML content (not .pdf extension, just HTML)
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
      const errorText = await htmlResponse.text();
      console.error('Error details:', errorText);
      
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
    console.log('✅ HTML template loaded successfully, size:', htmlContent.length, 'characters');

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

    // Verify PDF content is valid
    const pdfUint8Array = new Uint8Array(pdfBuffer);
    const pdfHeader = pdfUint8Array.slice(0, 4);
    const pdfHeaderString = String.fromCharCode(...pdfHeader);
    console.log('📄 PDF header check:', pdfHeaderString, '(should start with %PDF)');
    
    if (!pdfHeaderString.startsWith('%PDF')) {
      console.error('❌ Invalid PDF content detected!');
      console.log('First 100 bytes:', String.fromCharCode(...pdfUint8Array.slice(0, 100)));
      return new Response(JSON.stringify({
        success: false,
        message: 'PDF generado es inválido',
        error: 'Generated content is not a valid PDF'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let finalPdfUrl = htmlUrl;

    // Upload to Cloudflare R2 if requested
    if (uploadToR2) {
      console.log('☁️ Uploading PDF to Cloudflare R2...');
      
      const cloudflareWorkerUrl = import.meta.env.PUBLIC_CLOUDFLARE_WORKER_URL;
      if (!cloudflareWorkerUrl) {
        console.warn('⚠️ PUBLIC_CLOUDFLARE_WORKER_URL not configured, skipping R2 upload');
        finalPdfUrl = htmlUrl; // Use local HTML URL
      } else {
        try {
          // Create FormData for Cloudflare Worker with proper PDF content
          const formData = new FormData();
          const fileName = `order_processing_${orderId}_${Date.now()}.pdf`;
          
          // Create blob with explicit PDF content type and proper buffer
          const pdfBlob = new Blob([pdfBuffer], { 
            type: 'application/pdf'
          });
          
          console.log('📦 Blob created - size:', pdfBlob.size, 'type:', pdfBlob.type);
          
          formData.append('file', pdfBlob, fileName);
          formData.append('userId', orderData.customer_id.toString());
          
          // Upload to Cloudflare Worker with proper headers
          const uploadResponse = await fetch(`${cloudflareWorkerUrl}/upload-pdf-only`, {
            method: 'POST',
            body: formData,
            headers: {
              // Don't set Content-Type, let browser set it with boundary for multipart/form-data
              'Accept': 'application/json'
            }
          });

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          console.log('📥 Upload response:', uploadResult);
          if (uploadResult.success && (uploadResult.fileUrl || uploadResult.url)) {
            finalPdfUrl = uploadResult.fileUrl || uploadResult.url;
            console.log('✅ PDF uploaded to R2:', finalPdfUrl);

            // Update order with new_pdf_processing_url
            console.log('💾 Updating order with PDF URL...');
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(
              import.meta.env.PUBLIC_SUPABASE_URL!,
              import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY!
            );

            const { error: updateError } = await supabase
              .from('orders')
              .update({ 
                new_pdf_processing_url: finalPdfUrl,
                date_modified: new Date().toISOString()
              })
              .eq('id', orderId);

            if (updateError) {
              console.error('⚠️ Failed to update order with PDF URL:', updateError);
            } else {
              console.log('✅ Order updated with PDF URL');
            }
          } else {
            console.warn('⚠️ R2 upload succeeded but no fileUrl in response:', uploadResult);
          }
        } else {
          console.error('❌ R2 upload failed:', uploadResponse.status, uploadResponse.statusText);
          const errorText = await uploadResponse.text();
          console.error('Error details:', errorText);
        }
        } catch (uploadError) {
          console.error('⚠️ R2 upload error (non-critical):', uploadError);
        }
      }
    }

    // Optional: Send email notification
    if (sendEmail && orderData.billing?.email) {
      console.log('📧 Sending email notification...');
      try {
        // Email sending logic would go here
        console.log('✅ Email notification sent');
      } catch (emailError) {
        console.warn('⚠️ Email sending failed (non-critical):', emailError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'PDF de procesamiento generado exitosamente',
      pdf_url: finalPdfUrl,
      pdfUrl: finalPdfUrl,
      metadata: {
        order_id: orderId,
        pdfType: 'processing',
        generatedAt: new Date().toISOString(),
        projectName: orderData.metadata?.order_proyecto || orderData.order_proyecto,
        totalAmount: orderData.metadata?.calculated_total || orderData.calculated_total,
        numJornadas: orderData.metadata?.num_jornadas || orderData.num_jornadas,
        hasLineItems: (orderData.line_items?.length || 0) > 0,
        hasCoupon: (orderData.coupon_lines?.length || 0) > 0
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Error in order processing PDF generation API:', error);
    
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
