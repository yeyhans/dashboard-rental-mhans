import type { APIRoute } from 'astro';
import React from 'react';
import { UserContractDocument } from '../../../lib/pdf/components/contract/UserContractDocument';
import type { UserContractData } from '../../../lib/pdf/components/contract/UserContractDocument';
import { generatePdfBuffer } from '../../../lib/pdf/core/pdfService';

/**
 * Internal User Contract PDF Generation API using React-PDF
 * This API generates user contract PDFs using @react-pdf/renderer (replaces Puppeteer)
 * Called by external API and internal services
 */

// Email template generation function
interface ContractEmailData {
  user_id?: number;
  nombre?: string;
  apellido?: string;
  email?: string;
  rut?: string;
  telefono?: string;
  tipo_cliente?: string;
  empresa_nombre?: string;
  contractUrl?: string;
}

const generateContractEmailHTML = (data: ContractEmailData): string => {
  const customerName = `${data.nombre || ''} ${data.apellido || ''}`.trim();

  return `
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head>
<!--[if gte mso 15]>
<xml>
<o:OfficeDocumentSettings>
<o:AllowPNG/>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
<![endif]-->
<meta charset="UTF-8"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>*|MC:SUBJECT|*</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin=""/>
<!--[if !mso]><!--><link rel="stylesheet" type="text/css" id="newGoogleFontsStatic" href="https://fonts.googleapis.com/css?family=Source+Code+Pro:400,400i,700,700i,900,900i"/><!--<![endif]--><style>img{-ms-interpolation-mode:bicubic;}
table, td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
.mceStandardButton, .mceStandardButton td, .mceStandardButton td a{mso-hide:all!important;}
p, a, li, td, blockquote{mso-line-height-rule:exactly;}
p, a, li, td, body, table, blockquote{-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%;}
.mcnPreviewText{display:none!important;}
.bodyCell{margin:0 auto;padding:0;width:100%;}
.ExternalClass, .ExternalClass p, .ExternalClass td, .ExternalClass div, .ExternalClass span, .ExternalClass font{line-height:100%;}
.ReadMsgBody, .ExternalClass{width:100%;}
a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important;}
body{height:100%;margin:0;padding:0;width:100%;background:#ffffff;}
p{margin:0;padding:0;}
table{border-collapse:collapse;}
td, p, a{word-break:break-word;}
h1, h2, h3, h4, h5, h6{display:block;margin:0;padding:0;}
img, a img{border:0;height:auto;outline:none;text-decoration:none;}
a[href^="tel"], a[href^="sms"]{color:inherit;cursor:default;text-decoration:none;}
body, #bodyTable{background-color:rgb(235, 235, 235);}
.mceText, .mcnTextContent, .mceLabel{font-family:"Source Code Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;}
.mceText, .mcnTextContent, .mceLabel{color:rgb(255, 255, 255);}
.mceText p, .mceText label, .mceText input{margin-bottom:0;}
.mceText p, .mcnTextContent p{color:rgb(255, 255, 255);font-family:"Source Code Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;font-size:16px;font-weight:normal;line-height:1.5;mso-line-height-alt:150%;text-align:center;letter-spacing:0;direction:ltr;margin:0;}
.mceText a, .mcnTextContent a{color:rgb(0, 0, 0);font-style:normal;font-weight:normal;text-decoration:underline;direction:ltr;}
@media only screen and (max-width: 480px) {
body, table, td, p, a, li, blockquote{-webkit-text-size-adjust:none!important;}
body{width:100%!important;min-width:100%!important;}
.mceWidthContainer{max-width:660px!important;}
}
</style></head>
<body>
<center>
<table border="0" cellpadding="0" cellspacing="0" height="100%" width="100%" id="bodyTable" style="background-color: rgb(235, 235, 235);">
<tbody><tr>
<td class="bodyCell" align="center" valign="top">
<table id="root" border="0" cellpadding="0" cellspacing="0" width="100%">
<tbody>
<tr><td style="background-color:transparent" valign="top" align="center">
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:660px" role="presentation">
<tbody><tr><td style="background-color:#ffffff" valign="top">
<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
<tbody><tr><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top">
<table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
<tbody><tr><td style="padding-top:0;padding-bottom:0" valign="top" width="100%">
<table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
<tbody>
<tr><td style="background-color:transparent;padding:25px" valign="top" align="left">
<a href="https://rental.mariohans.cl" style="display:block" target="_blank">
<img alt="" src="https://media.mariohans.cl/logos/Recurso%2016%403x.png" width="200" height="auto" style="display:block;max-width:100%;height:auto"/>
</a>
</td></tr>
<tr><td style="padding:24px" valign="top">
<div style="width:100%">
<p style="text-align: left;"><span style="color:#000000;font-size: 13px">Hola ${customerName},</span></p>
<p style="text-align: left;"><span style="color:#000000;font-size: 13px">Tu cuenta ha sido creada con éxito. A partir de ahora, puedes explorar y reservar el equipo fotográfico que necesites para tus proyectos. Estamos disponibles los </span><strong><span style="color:#000000;font-size: 13px">7 días de la semana con horario extendido 8:00 a 20:00 hrs</span></strong><span style="color:#000000;font-size: 13px">, para ser tu aliado en cada producción.</span></p>
<p><br/></p>
<p style="text-align: left;"><span style="color:#000000;font-size: 13px">📄 </span><strong><span style="color:#000000;font-size: 13px">Información importante</span></strong></p>
<p style="text-align: left;"><span style="color:#000000;font-size: 13px">Adjunto encontrarás el contrato con los </span><strong><span style="color:#000000;font-size: 13px">términos y condiciones de arriendo</span></strong><span style="color:#000000;font-size: 13px">, junto con toda la información legal necesaria. Te recomendamos revisarlo con detalle antes de realizar tu primer arriendo.</span></p>
<p><br/></p>
<p style="text-align: left;"><span style="color:#000000;font-size: 13px">Si tienes cualquier duda, aquí estamos para ayudarte.</span></p>
<p style="text-align: left;"><span style="color:#000000;font-size: 13px">Saludos,</span></p>
<p style="text-align: left;"><br/><strong><span style="color:#000000;font-size: 13px">Mario Hans FotoRental</span></strong></p>
</div>
</td></tr>
<tr><td style="padding:12px" valign="top" align="center">
<table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation">
<tbody><tr><td style="background-color:#000000;border-radius:15px;text-align:center" valign="top">
<a href="${data.contractUrl}" target="_blank" style="background-color:#000000;border-radius:15px;border:2px none #000000;color:#ffffff;display:block;font-family:'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;font-weight:normal;padding:16px 28px;text-decoration:none;text-align:center" rel="noreferrer">Descarga tu contrato.</a>
</td></tr></tbody></table>
</td></tr>
</tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table>
</td></tr>
</tbody>
</table>
</td>
</tr>
</tbody></table>
</center>
</body></html>
  `;
};

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('📄 Internal user contract PDF generation API called (React-PDF)');

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
    const contractData: UserContractData = {
      user_id: userData.user_id,
      nombre: userData.nombre || '',
      apellido: userData.apellido || '',
      email: userData.email || '',
      rut: userData.rut || '',
      direccion: userData.direccion || '',
      ciudad: userData.ciudad || '',
      pais: userData.pais || 'Chile',
      telefono: userData.telefono || '',
      instagram: userData.instagram,
      fecha_nacimiento: userData.fecha_nacimiento,
      tipo_cliente: userData.tipo_cliente || 'natural',
      empresa_nombre: userData.empresa_nombre,
      empresa_rut: userData.empresa_rut,
      empresa_ciudad: userData.empresa_ciudad,
      empresa_direccion: userData.empresa_direccion,
      url_firma: userData.url_firma,
      terminos_aceptados: userData.terminos_aceptados || false,
    };

    console.log('📋 Contract data prepared:', {
      user_id: contractData.user_id,
      nombre: contractData.nombre,
      apellido: contractData.apellido,
      tipo_cliente: contractData.tipo_cliente,
      terminos_aceptados: contractData.terminos_aceptados
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
      contractUrl,
      hasUserEmail: !!userData.email,
      userEmail: userData.email
    });

    if (sendEmail && contractUrl && userData.email) {
      console.log('📧 Sending contract notification email...');

      try {
        // Import Resend
        const { Resend } = await import('resend');
        const resend = new Resend(import.meta.env.RESEND_API_KEY);

        if (!import.meta.env.RESEND_API_KEY) {
          console.error('❌ RESEND_API_KEY not configured');
          throw new Error('RESEND_API_KEY not configured');
        }

        // Generate HTML email content
        const emailData: ContractEmailData = {
          user_id: parseInt(user_id),
          nombre: userData.nombre,
          apellido: userData.apellido,
          email: userData.email,
          rut: userData.rut,
          telefono: userData.telefono,
          tipo_cliente: userData.tipo_cliente,
          empresa_nombre: userData.empresa_nombre,
          contractUrl: contractUrl
        };

        const htmlContent = generateContractEmailHTML(emailData);

        // Fetch PDF from R2 to attach it
        console.log('📎 Fetching PDF from R2 for email attachment...');
        const pdfResponse = await fetch(contractUrl);

        if (!pdfResponse.ok) {
          throw new Error(`Failed to fetch PDF from R2: ${pdfResponse.status}`);
        }

        const pdfArrayBuffer = await pdfResponse.arrayBuffer();
        console.log('✅ PDF fetched, size:', pdfArrayBuffer.byteLength, 'bytes');

        // Send email with Resend
        console.log('📧 Sending email to:', userData.email);
        const emailResult = await resend.emails.send({
          from: 'contratos@mail.mariohans.cl',
          to: [userData.email],
          subject: '✅ Contrato Generado - Mario Hans Rental',
          html: htmlContent,
          attachments: [{
            filename: `contrato_${user_id}.pdf`,
            content: Buffer.from(pdfArrayBuffer)
          }]
        });

        console.log('✅ Email sent successfully:', emailResult);
        emailSent = true;

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
