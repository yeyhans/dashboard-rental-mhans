import type { APIRoute } from 'astro';
import React from 'react';
import { UserContractDocument } from '../../../lib/pdf/components/contract/UserContractDocument';
import { SiteSettingsService } from '../../../services/siteSettingsService';
import { buildUserContractData } from '../../../lib/pdf/mappers/contractData';
import { generatePdfBuffer } from '../../../lib/pdf/core/pdfService';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '../../../lib/rateLimit';
import { getServerAdmin } from '../../../lib/supabase';
import { TransactionalEmailService } from '../../../services/transactionalEmailService';
import { validateFrontendApiKey } from '../../../lib/serverApiAuth';

/**
 * Internal User Contract PDF Generation API using React-PDF
 * This API generates user contract PDFs using @react-pdf/renderer (replaces Puppeteer)
 * Called by external API and internal services.
 *
 * Auth: requires either an inter-service API key (X-API-Key matching FRONTEND_API_SECRET)
 * or an authenticated dashboard admin session.
 */

async function validateContractRequest(request: Request): Promise<boolean> {
  if (validateFrontendApiKey(request)) return true;
  return false;
}

export const POST: APIRoute = async (context) => {
  const { request } = context;
  try {
    // Rate limiting: 5 requests per minute
    const ip = getClientIp(request);
    const rl = checkRateLimit(ip, RATE_LIMITS.pdfGeneration);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    // Auth validation — inter-service/API key first, then admin cookie session
    let authorized = await validateContractRequest(request);
    if (!authorized) {
      const adminSession = await getServerAdmin(context as any);
      authorized = !!adminSession;
    }
    if (!authorized) {
      console.error('[POST /api/contracts/generate-pdf] Solicitud no autorizada');
      return new Response(JSON.stringify({
        success: false,
        error: 'No autorizado'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[POST /api/contracts/generate-pdf] Solicitud autorizada');

    // Parse request body
    const requestData = await request.json();
    const { userData, uploadToR2 = true } = requestData;
    // ALWAYS send email when generating contracts
    const sendEmail = true;

    console.log('📋 Contract generation request:', {
      user_id: userData?.user_id,
      email: userData?.email,
      nombre: userData?.nombre,
      uploadToR2,
      sendEmail: sendEmail,
      note: 'Email sending is ALWAYS enabled for contracts'
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

    console.log('📄 Generating contract PDF with React-PDF...');

    // Prepare contract data
    const settings = await SiteSettingsService.get();
    const contractData = buildUserContractData(userData, new Date(), settings);

    console.log('📋 Contract data prepared:', {
      user_id: contractData.userId,
      isCompany: contractData.isCompany,
      hasSignature: !!contractData.signatureImageUrl
    });

    // Generate PDF using React-PDF
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await generatePdfBuffer({
        document: React.createElement(UserContractDocument, { data: contractData })
      });

      console.log('✅ Contract PDF generated successfully with React-PDF, size:', pdfBuffer.byteLength, 'bytes');
    } catch (pdfError) {
      console.error('❌ PDF generation error:', pdfError);
      throw new Error(`PDF generation failed: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`);
    }

    // Verify PDF content is valid
    const pdfUint8Array = new Uint8Array(pdfBuffer);
    const pdfHeader = pdfUint8Array.slice(0, 4);
    const pdfHeaderString = String.fromCharCode(...pdfHeader);
    console.log('📄 PDF header check:', pdfHeaderString, '(should start with %PDF)');

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
        formData.append('userId', String(user_id));

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

        const { error: updateError } = await supabase
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
    let emailSent = false;
    console.log('🔍 Email sending check:', {
      sendEmail,
      hasContractUrl: !!contractUrl,
      hasUserEmail: !!userData.email,
    });

    if (sendEmail && contractUrl && userData.email) {
      console.log('📧 Sending contract notification email...');
      // R-09d: the approved "Contrato" design (02), with the contract just generated attached
      // (handoff §7: Contrato_arriendo.pdf). The service fails closed without the worker secret
      // and never throws; the PDF is already saved, so the email stays best effort.
      const customerName = `${userData.nombre || ''} ${userData.apellido || ''}`.trim();
      const emailResult = await TransactionalEmailService.sendToCustomer(
        "contrato",
        { email: userData.email, name: userData.empresa_nombre || customerName },
        {
          attachment: {
            filename: 'Contrato_arriendo.pdf',
            content: Buffer.from(pdfBuffer).toString('base64'),
          },
        },
      );
      emailSent = emailResult.sent;
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
        emailSent: emailSent,
        generationMethod: 'react-pdf'
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
