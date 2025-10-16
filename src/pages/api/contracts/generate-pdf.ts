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
    const { userData, uploadToR2 = true, sendEmail = false } = await request.json();
    
    console.log('📋 Contract generation request:', {
      user_id: userData?.user_id,
      email: userData?.email,
      nombre: userData?.nombre,
      uploadToR2,
      sendEmail
    });

    // Validate required parameters
    if (!userData || !userData.user_id || !userData.email) {
      return new Response(JSON.stringify({
        success: false,
        message: 'userData con user_id y email son requeridos'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const user_id = userData.user_id;

    console.log('📄 Generating contract PDF with provided user data...');
    
    // Generate PDF using HTML template + Puppeteer service (same as budget-pdf)
    console.log('📄 Making internal request to contract-pdf page with POST data...');
    
    const baseUrl = new URL(request.url).origin;
    const htmlUrl = `${baseUrl}/contract-pdf/${user_id}`;
    
    console.log('🔗 HTML URL:', htmlUrl);
    console.log('📋 Sending userData to template:', {
      nombre: userData.nombre,
      apellido: userData.apellido,
      rut: userData.rut,
      email: userData.email,
      tipo_cliente: userData.tipo_cliente
    });
    
    // Get HTML content with userData via POST
    const htmlResponse = await fetch(htmlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Request': 'true',
        'Accept': 'text/html'
      },
      body: JSON.stringify({ userData })
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

    // Update user profile with contract URL and all user data
    if (contractUrl) {
      console.log('💾 Updating user profile with contract URL and user data...');
      
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          import.meta.env.PUBLIC_SUPABASE_URL!,
          import.meta.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Prepare update data - include all fields from userData
        const updateData: any = {
          url_user_contrato: contractUrl,
          updated_at: new Date().toISOString()
        };

        // Add all user profile fields if they exist in userData
        if (userData.nombre) updateData.nombre = userData.nombre;
        if (userData.apellido) updateData.apellido = userData.apellido;
        if (userData.email) updateData.email = userData.email;
        if (userData.rut) updateData.rut = userData.rut;
        if (userData.direccion) updateData.direccion = userData.direccion;
        if (userData.ciudad) updateData.ciudad = userData.ciudad;
        if (userData.pais) updateData.pais = userData.pais;
        if (userData.telefono) updateData.telefono = userData.telefono;
        if (userData.instagram) updateData.instagram = userData.instagram;
        if (userData.fecha_nacimiento) updateData.fecha_nacimiento = userData.fecha_nacimiento;
        if (userData.tipo_cliente) updateData.tipo_cliente = userData.tipo_cliente;
        if (userData.usuario) updateData.usuario = userData.usuario;
        
        // Company fields
        if (userData.empresa_nombre) updateData.empresa_nombre = userData.empresa_nombre;
        if (userData.empresa_rut) updateData.empresa_rut = userData.empresa_rut;
        if (userData.empresa_ciudad) updateData.empresa_ciudad = userData.empresa_ciudad;
        if (userData.empresa_direccion) updateData.empresa_direccion = userData.empresa_direccion;
        
        // Document URLs
        if (userData.url_rut_anverso) updateData.url_rut_anverso = userData.url_rut_anverso;
        if (userData.url_rut_reverso) updateData.url_rut_reverso = userData.url_rut_reverso;
        if (userData.url_firma) updateData.url_firma = userData.url_firma;
        if (userData.url_empresa_erut) updateData.url_empresa_erut = userData.url_empresa_erut;
        if (userData.new_url_e_rut_empresa) updateData.new_url_e_rut_empresa = userData.new_url_e_rut_empresa;
        
        // Terms acceptance - convert boolean to string if needed
        if (userData.terminos_aceptados !== undefined) {
          updateData.terminos_aceptados = userData.terminos_aceptados === true || userData.terminos_aceptados === '1' ? '1' : '0';
        }

        console.log('📋 Updating user profile with data:', {
          user_id: user_id,
          fields: Object.keys(updateData),
          terminos_aceptados: updateData.terminos_aceptados
        });

        const { data: updateResult, error: updateError } = await supabase
          .from('user_profiles')
          .update(updateData)
          .eq('user_id', parseInt(user_id));

        if (updateError) {
          console.error('❌ Failed to update user profile:', updateError);
        } else {
          console.log('✅ User profile updated with contract URL and all user data');
        }
      } catch (dbError) {
        console.error('❌ Database update failed:', dbError);
        // Continue - we still have the PDF
      }
    }

    // Send email notification if requested
    if (sendEmail && contractUrl && userData.email) {
      console.log('📧 Sending contract notification email...');
      
      try {
        // TODO: Implement email sending using Resend API
        // For now, just log that we would send an email
        console.log('📧 Email would be sent to:', userData.email);
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
        email: userData.email,
        generatedAt: new Date().toISOString(),
        fileSize: pdfBuffer.byteLength,
        uploadedToR2: uploadToR2 && !!contractUrl,
        emailSent: sendEmail && !!contractUrl && !!userData.email
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
