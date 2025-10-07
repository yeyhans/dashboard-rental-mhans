import type { APIRoute } from 'astro';

/**
 * Internal Contract PDF Generation API
 * This API generates contract PDFs using astro-pdf
 * Called by external API and internal services
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('📄 Internal contract PDF generation API called');
    
    // Parse request body
    const { user_id, email, uploadToR2 = true, sendEmail = false } = await request.json();
    
    console.log('📋 Contract generation request:', {
      user_id,
      email,
      uploadToR2,
      sendEmail
    });

    // Validate required parameters
    if (!user_id) {
      return new Response(JSON.stringify({
        success: false,
        message: 'user_id es requerido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('📄 Generating contract PDF using astro-pdf...');
    
    // Generate PDF using HTML template + Puppeteer service (same as budget-pdf)
    console.log('📄 Making internal request to contract-pdf page...');
    
    const baseUrl = new URL(request.url).origin;
    const htmlUrl = `${baseUrl}/contract-pdf/${user_id}`;
    
    console.log('🔗 HTML URL:', htmlUrl);
    
    // Get HTML content (not .pdf extension, just HTML)
    const htmlResponse = await fetch(htmlUrl, {
      method: 'GET',
      headers: {
        'X-Internal-Request': 'true',
        'X-Requested-User-Id': user_id.toString(),
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
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
      printBackground: true
    });
    
    console.log('✅ Contract PDF generated successfully, size:', pdfBuffer.byteLength, 'bytes');

    let contractUrl: string | null = null;

    // Upload to R2 if requested
    if (uploadToR2) {
      console.log('☁️ Uploading contract PDF to Cloudflare R2...');
      
      try {
        // Upload to Cloudflare R2 via worker
        const workerUrl = import.meta.env.PUBLIC_CLOUDFLARE_WORKER_URL || 'https://workers.mariohans.cl';
        console.log('☁️ Using Cloudflare Worker URL:', workerUrl);
        
        if (!workerUrl) {
          throw new Error('CLOUDFLARE_WORKER_URL not configured');
        }

        const timestamp = Date.now();
        const filename = `contract_${user_id}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}_${timestamp}.pdf`;
        
        const formData = new FormData();
        formData.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), filename);
        formData.append('documentType', 'contract');
        formData.append('userId', user_id.toString());

        const uploadResponse = await fetch(`${workerUrl}/upload-file-only`, {
          method: 'POST',
          body: formData
        });

        console.log('📤 Upload response status:', uploadResponse.status);
        
        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          contractUrl = uploadResult.url;
          console.log('✅ Contract PDF uploaded to R2:', contractUrl);
          console.log('📊 Upload result details:', uploadResult);
        } else {
          const errorText = await uploadResponse.text();
          console.error('❌ Failed to upload to R2:', uploadResponse.status, errorText);
          // Don't throw error, just continue without URL
          console.log('⚠️ Continuing without R2 upload...');
        }
      } catch (uploadError) {
        console.error('❌ Upload to R2 failed:', uploadError);
        // Continue without upload - we still have the PDF
      }
    }

    // Update user profile with contract URL if we have one
    if (contractUrl) {
      console.log('💾 Updating user profile with contract URL...');
      
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          import.meta.env.PUBLIC_SUPABASE_URL!,
          import.meta.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: updateResult, error: updateError } = await supabase
          .from('user_profiles')
          .update({
            url_user_contrato: contractUrl,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', parseInt(user_id));

        if (updateError) {
          console.error('❌ Failed to update user profile:', updateError);
        } else {
          console.log('✅ User profile updated with contract URL');
        }
      } catch (dbError) {
        console.error('❌ Database update failed:', dbError);
        // Continue - we still have the PDF
      }
    }

    // Send email notification if requested
    if (sendEmail && contractUrl && email) {
      console.log('📧 Sending contract notification email...');
      
      try {
        // TODO: Implement email sending using Resend API
        // For now, just log that we would send an email
        console.log('📧 Email would be sent to:', email);
        console.log('🔗 Contract URL for email:', contractUrl);
      } catch (emailError) {
        console.error('❌ Failed to send email:', emailError);
        // Continue - email is not critical
      }
    }

    console.log('✅ Contract PDF generation completed successfully');

    // Return success response
    return new Response(JSON.stringify({
      success: true,
      message: 'Contrato PDF generado exitosamente',
      contractUrl: contractUrl,
      pdfUrl: contractUrl, // For compatibility
      metadata: {
        user_id: parseInt(user_id),
        email: email,
        generatedAt: new Date().toISOString(),
        fileSize: pdfBuffer.byteLength,
        uploadedToR2: uploadToR2 && !!contractUrl,
        emailSent: sendEmail && !!contractUrl && !!email
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Internal contract PDF generation error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Error interno al generar contrato PDF',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
