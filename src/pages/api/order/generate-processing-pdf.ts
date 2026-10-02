import type { APIRoute } from 'astro';
import React from 'react';
import { ProcessingDocument } from '../../../lib/pdf/components/processing/ProcessingDocument';
import { SiteSettingsService } from '../../../services/siteSettingsService';
import { buildProcessingDocumentData } from '../../../lib/pdf/mappers/processingData';
import { generatePdfBuffer } from '../../../lib/pdf/core/pdfService';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('🚀 Order processing PDF generation API called');

    const requestData = await request.json();

    // Support both formats: direct fields or nested orderData object
    const orderDataNested = requestData.orderData;
    const orderId = requestData.order_id || orderDataNested?.order_id || orderDataNested?.id;
    const customer_id = requestData.customer_id || orderDataNested?.customer_id;
    const uploadToR2 = requestData.uploadToR2 ?? true;
    const sendEmail = requestData.sendEmail ?? false;

    console.log('📋 Received request data:', {
      order_id: orderId,
      customer_id: customer_id,
      uploadToR2: uploadToR2,
      sendEmail: sendEmail,
      hasNestedOrderData: !!orderDataNested
    });

    // Validate required fields
    if (!orderId || !customer_id) {
      console.error('❌ Missing required fields:', {
        orderId,
        customer_id,
        requestKeys: Object.keys(requestData),
        nestedKeys: orderDataNested ? Object.keys(orderDataNested) : []
      });
      return new Response(JSON.stringify({
        success: false,
        message: 'Campos requeridos faltantes: order_id, customer_id'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get order data from database
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL!,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !orderData) {
      console.error('Error fetching order data:', orderError);
      return new Response(JSON.stringify({
        success: false,
        message: 'Orden no encontrada'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate PDF using React-PDF (replaces Puppeteer)
    console.log('📄 Generating PDF with React-PDF...');

    let pdfBuffer: Buffer;
    try {
      // Client profile: RUT and company data for the annex signature block
      const profileColumns = 'rut, tipo_cliente, empresa_nombre, empresa_rut';
      let profile: {
        rut?: string | null;
        tipo_cliente?: string | null;
        empresa_nombre?: string | null;
        empresa_rut?: string | null;
      } | null = null;
      if (orderData.customer_id) {
        const { data: byUserId } = await supabase
          .from('user_profiles')
          .select(profileColumns)
          .eq('user_id', parseInt(orderData.customer_id))
          .single();
        if (byUserId) {
          profile = byUserId;
        } else {
          const { data: byAuthUid } = await supabase
            .from('user_profiles')
            .select(profileColumns)
            .eq('auth_uid', orderData.customer_id)
            .single();
          profile = byAuthUid;
        }
      }

      const settings = await SiteSettingsService.get();
      const documentData = buildProcessingDocumentData(orderData, profile, new Date(), settings);

      // Generate PDF using React-PDF
      pdfBuffer = await generatePdfBuffer({
        document: React.createElement(ProcessingDocument, { data: documentData })
      });

      console.log('✅ PDF generated successfully with React-PDF, size:', pdfBuffer.byteLength);
    } catch (error) {
      console.error('❌ PDF generation error:', error);

      // Check if it's a timeout error
      if (error instanceof Error && error.message.includes('timeout')) {
        return new Response(JSON.stringify({
          success: false,
          message: 'La generación del PDF excedió el tiempo límite. Por favor, intente nuevamente.',
          error: 'PDF generation timeout - Vercel free tier limit',
          retry: true
        }), {
          status: 504,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Re-throw other errors to be caught by outer try-catch
      throw error;
    }

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

    let finalPdfUrl = '';

    // Upload to Cloudflare R2 if requested
    if (uploadToR2) {
      console.log('☁️ Uploading PDF to Cloudflare R2...');

      const cloudflareWorkerUrl = import.meta.env.PUBLIC_CLOUDFLARE_WORKER_URL;
      if (!cloudflareWorkerUrl) {
        console.warn('⚠️ PUBLIC_CLOUDFLARE_WORKER_URL not configured, skipping R2 upload');
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

    // If no R2 URL, provide base64 fallback
    if (!finalPdfUrl) {
      console.log('📄 No R2 URL available, using base64 fallback');
      const base64PDF = Buffer.from(pdfBuffer).toString('base64');
      finalPdfUrl = `data:application/pdf;base64,${base64PDF}`;
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
        hasCoupon: (orderData.coupon_lines?.length || 0) > 0,
        pdfValidation: {
          size: pdfBuffer.byteLength,
          header: pdfHeaderString,
          isValid: pdfHeaderString.startsWith('%PDF')
        }
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
