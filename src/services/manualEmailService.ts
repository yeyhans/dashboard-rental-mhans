// Manual Email Service for Order Management
// This service handles manual email sending with document attachments

export interface ManualEmailData {
  // Recipient information
  to: string;
  customerName: string;
  
  // Order information
  orderId: number;
  projectName?: string;
  
  // Email content
  subject: string;
  message: string;
  emailType: 'availability_confirmation' | 'order_update' | 'warranty_photos' | 'custom';
  
  // Document attachments
  attachments?: {
    budgetUrl?: string;
    budgetUrls?: string[]; // Support for multiple budget URLs
    contractUrl?: string;
    warrantyPhotos?: string[]; // Support for warranty photos
    customDocuments?: Array<{
      name: string;
      url: string;
      type: 'budget' | 'contract' | 'warranty' | 'other';
    }>;
  } | undefined;
}

export interface ManualEmailResult {
  success: boolean;
  message: string;
  emailId?: string;
  error?: string;
}

/**
 * Send manual email with document attachments
 */
export const sendManualEmail = async (emailData: ManualEmailData): Promise<ManualEmailResult> => {
  try {
    console.log('📧 Starting manual email sending process...');
    console.log('📋 Email data:', {
      to: emailData.to,
      orderId: emailData.orderId,
      emailType: emailData.emailType,
      hasAttachments: !!(emailData.attachments?.budgetUrl || emailData.attachments?.budgetUrls?.length || emailData.attachments?.contractUrl || emailData.attachments?.warrantyPhotos?.length || emailData.attachments?.customDocuments?.length)
    });

    // Validate required fields
    if (!emailData.to || !emailData.subject || !emailData.message || !emailData.orderId) {
      console.error('❌ Missing required email fields');
      return {
        success: false,
        message: 'Campos requeridos: destinatario, asunto, mensaje y ID de orden',
        error: 'Missing required fields'
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailData.to)) {
      return {
        success: false,
        message: 'Formato de email inválido',
        error: 'Invalid email format'
      };
    }

    // Generate email content based on type
    const htmlContent = generateManualEmailTemplate(emailData);

    // Prepare email payload
    const emailPayload = {
      to: emailData.to,
      subject: emailData.subject,
      html: htmlContent,
      attachments: emailData.attachments,
      metadata: {
        type: 'manual_email',
        order_id: emailData.orderId,
        email_type: emailData.emailType,
        sent_by: 'admin',
        sent_at: new Date().toISOString()
      }
    };

    console.log('📤 Sending manual email...');

    // Call the manual email API endpoint
    const response = await fetch('/api/emails/send-manual-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Request': 'true',
      },
      body: JSON.stringify(emailPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Manual email API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      return {
        success: false,
        message: 'Error al enviar el correo',
        error: `API error: ${response.statusText}`
      };
    }

    const result = await response.json();
    console.log('📥 Manual email API response:', result);

    if (result.success) {
      console.log('✅ Manual email sent successfully:', result.emailId);
      return {
        success: true,
        message: 'Correo enviado exitosamente',
        emailId: result.emailId
      };
    } else {
      console.error('❌ Manual email API returned error:', result.error);
      return {
        success: false,
        message: result.message || 'Error al enviar el correo',
        error: result.error
      };
    }

  } catch (error) {
    console.error('💥 Error sending manual email:', error);
    return {
      success: false,
      message: 'Error interno al enviar el correo',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Generate HTML template for manual emails using MailChimp-style inline HTML
 */
function generateManualEmailTemplate(emailData: ManualEmailData): string {
  const { customerName, orderId, projectName, message, emailType, attachments } = emailData;
  
  // Get email type configuration
  const getEmailTypeTitle = () => {
    switch (emailType) {
      case 'availability_confirmation':
        return 'Confirmación de Disponibilidad';
      case 'order_update':
        return 'Actualización de Pedido';
      default:
        return 'Comunicación Importante';
    }
  };

  const emailTitle = getEmailTypeTitle();
  
  // Count attachments for display
  const budgetCount = (attachments?.budgetUrl ? 1 : 0) + (attachments?.budgetUrls?.length || 0);
  const warrantyPhotosCount = attachments?.warrantyPhotos?.length || 0;
  const attachmentCount = budgetCount + 
                         (attachments?.contractUrl ? 1 : 0) + 
                         warrantyPhotosCount +
                         (attachments?.customDocuments?.length || 0);

  const emailHtml = `
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
    <title>${emailTitle} - ${projectName || 'Orden'} #${orderId}</title>
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
    body, #bodyTable{background-color:rgb(235, 235, 235);}
    .mceText, .mcnTextContent, .mceLabel{font-family:"Source Code Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;}
    .mceText, .mcnTextContent, .mceLabel{color:rgb(255, 255, 255);}
    .mceText p, .mcnTextContent p{color:rgb(255, 255, 255);font-family:"Source Code Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;font-size:16px;font-weight:normal;line-height:1.5;text-align:center;letter-spacing:0;direction:ltr;margin:0;}
    .mceText a, .mcnTextContent a{color:rgb(0, 0, 0);font-style:normal;font-weight:normal;text-decoration:underline;direction:ltr;}
    p.mcePastedContent, h1.mcePastedContent, h2.mcePastedContent, h3.mcePastedContent, h4.mcePastedContent{text-align:left;}
    @media only screen and (max-width: 480px) {
    body, table, td, p, a, li, blockquote{-webkit-text-size-adjust:none!important;}
    body{width:100%!important;min-width:100%!important;}
    .mceText p{margin:0;font-size:16px!important;line-height:1.5!important;}
    .bodyCell{padding-left:16px!important;padding-right:16px!important;}
    }</style></head>
    <body>
    <center>
    <table border="0" cellpadding="0" cellspacing="0" height="100%" width="100%" id="bodyTable" style="background-color: rgb(235, 235, 235);">
    <tbody><tr>
    <td class="bodyCell" align="center" valign="top">
    <table id="root" border="0" cellpadding="0" cellspacing="0" width="100%"><tbody data-block-id="4" class="mceWrapper"><tr><td style="background-color:#ebebeb" valign="top" align="center" class="mceSectionHeader"><!--[if (gte mso 9)|(IE)]><table align="center" border="0" cellspacing="0" cellpadding="0" width="660" style="width:660px;"><tr><td><![endif]--><table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:660px" role="presentation"><tbody><tr><td style="background-color:#ffffff" valign="top" class="mceWrapperInner"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="3"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0" valign="top" class="mceColumn" id="mceColumnId--7" data-block-id="-7" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="background-color:#000000;padding-top:40px;padding-bottom:40px;padding-right:40px;padding-left:40px;border:0;border-radius:0" valign="top" class="mceImageBlockContainer" align="left" id="b20"><div><!--[if !mso]><!--></div><a href="https://rental.mariohans.cl" style="display:block" target="_blank" data-block-id="20"><table align="left" border="0" cellpadding="0" cellspacing="0" width="50%" style="border-collapse:separate;margin:0;vertical-align:top;max-width:50%;width:50%;height:auto" role="presentation" data-testid="image-20"><tbody><tr><td style="border:0;border-radius:0;margin:0" valign="top"><img alt="" src="https://mcusercontent.com/9ba4e87550786c74a0e5dc97e/images/87791a39-5396-8f56-d47d-22a92f2a3afe.png" width="290" height="auto" style="display:block;max-width:100%;height:auto;border-radius:0" class="imageDropZone mceLogo"/></td></tr></tbody></table></a><div><!--<![endif]--></div><div>
    <!--[if mso]>
    <a href="https://rental.mariohans.cl"><span class="mceImageBorder" style="border:0;border-width:2px;vertical-align:top;margin:0"><img role="presentation" class="imageDropZone mceLogo" src="https://mcusercontent.com/9ba4e87550786c74a0e5dc97e/images/87791a39-5396-8f56-d47d-22a92f2a3afe.png" alt="" width="290" height="auto" style="display:block;max-width:290px;width:290px;height:auto"/></span></a>
    <![endif]-->
    </div></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table><!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]--></td></tr></tbody><tbody data-block-id="11" class="mceWrapper"><tr><td style="background-color:transparent" valign="top" align="center" class="mceSectionBody"><!--[if (gte mso 9)|(IE)]><table align="center" border="0" cellspacing="0" cellpadding="0" width="660" style="width:660px;"><tr><td><![endif]--><table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:660px" role="presentation"><tbody><tr><td style="background-color:#ffffff" valign="top" class="mceWrapperInner"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="10"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0" valign="top" class="mceColumn" id="mceColumnId--8" data-block-id="-8" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0;padding-right:0;padding-left:0" valign="top" class="mceGutterContainer" id="gutterContainerId-25"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0;padding-right:0;padding-left:0;border:0;border-radius:0" valign="top" id="b25"><table width="100%" style="border:0;background-color:transparent;border-radius:0;border-collapse:separate"><tbody><tr><td style="padding-left:20px;padding-right:20px;padding-top:20px;padding-bottom:20px" class="mceTextBlockContainer"><div data-block-id="25" class="mceText" id="d25" style="width:100%"><p style="text-align: left;" class="last-child"><span style="color:rgb(0, 0, 0);"><span style="font-size: 15px">${emailTitle}.</span></span></p></div></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td style="background-color:transparent;padding-top:17px;padding-bottom:17px;padding-right:17px;padding-left:17px;border:0;border-radius:0" valign="top" class="mceDividerBlockContainer" id="b23"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:transparent;width:100%" role="presentation" class="mceDividerContainer" data-block-id="23"><tbody><tr><td style="min-width:100%;border-top-width:1px;border-top-style:solid;border-top-color:#000000;line-height:0;font-size:0" valign="top" class="mceDividerBlock"> </td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table><!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]--></td></tr></tbody><tbody data-block-id="17" class="mceWrapper"><tr><td style="background-color:transparent" valign="top" align="center" class="mceSectionFooter"><!--[if (gte mso 9)|(IE)]><table align="center" border="0" cellspacing="0" cellpadding="0" width="660" style="width:660px;"><tr><td><![endif]--><table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:660px" role="presentation"><tbody><tr><td style="background-color:#ffffff" valign="top" class="mceWrapperInner"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="16"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0" valign="top" class="mceColumn" id="mceColumnId--9" data-block-id="-9" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0;padding-right:0;padding-left:0" valign="top" class="mceGutterContainer" id="gutterContainerId-22"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0;padding-right:0;padding-left:0;border:0;border-radius:0" valign="top" id="b22"><table width="100%" style="border:0;background-color:transparent;border-radius:0;border-collapse:separate"><tbody><tr><td style="padding-left:24px;padding-right:24px;padding-top:12px;padding-bottom:12px" class="mceTextBlockContainer"><div data-block-id="22" class="mceText" id="d22" style="width:100%">
    
    <p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Hola ${customerName},\n\n</span></span></span></span></p>
    <p class="mcePastedContent"><br/></p>
    <p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">${message}</span></span></span></span></p>
    <p class="mcePastedContent"><br/></p>
    
    ${attachmentCount > 0 ? `
    <p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">📎 <strong>Documentos adjuntos:</strong></span></span></span></span></p>
    <p class="mcePastedContent"><br/></p>
    
    ${attachments?.budgetUrl ? `
    <p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">💰 <a href="${attachments.budgetUrl}" target="_blank">Ver Presupuesto</a></span></span></span></span></p>
    ` : ''}
    
    ${attachments?.budgetUrls?.map((budgetUrl, index) => `
    <p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">💰 <a href="${budgetUrl.trim()}" target="_blank">Ver Presupuesto ${index + 1}</a></span></span></span></span></p>
    `).join('') || ''}
    
    ${attachments?.contractUrl ? `
    <p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">📄 <a href="${attachments.contractUrl}" target="_blank">Ver Contrato</a></span></span></span></span></p>
    ` : ''}
    
    ${attachments?.warrantyPhotos?.length ? `
    <p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">📸 <strong>Fotos de Garantía (${attachments.warrantyPhotos.length}):</strong></span></span></span></span></p>
    <p class="mcePastedContent"><br/></p>
    
    ${attachments.warrantyPhotos.map((photoUrl, index) => `
    <p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">🖼️ <a href="${photoUrl.trim()}" target="_blank">Ver Foto ${index + 1}</a></span></span></span></span></p>
    `).join('') || ''}
    
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 10px 0;">
    <tbody><tr><td style="padding: 10px;">
    <table border="0" cellpadding="5" cellspacing="5" width="100%">
    <tbody><tr>
    ${attachments.warrantyPhotos.slice(0, 3).map((photoUrl, index) => `
    <td align="center" style="width: 33.33%;">
    <a href="${photoUrl.trim()}" target="_blank" style="text-decoration: none;">
    <img src="${photoUrl.trim()}" alt="Foto de Garantía ${index + 1}" style="max-width: 150px; max-height: 150px; border: 2px solid #e2e8f0; border-radius: 8px; object-fit: cover;" />
    </a>
    </td>
    `).join('')}
    </tr></tbody></table>
    ${attachments.warrantyPhotos.length > 3 ? `
    <table border="0" cellpadding="5" cellspacing="5" width="100%">
    <tbody><tr>
    ${attachments.warrantyPhotos.slice(3, 6).map((photoUrl, index) => `
    <td align="center" style="width: 33.33%;">
    <a href="${photoUrl.trim()}" target="_blank" style="text-decoration: none;">
    <img src="${photoUrl.trim()}" alt="Foto de Garantía ${index + 4}" style="max-width: 150px; max-height: 150px; border: 2px solid #e2e8f0; border-radius: 8px; object-fit: cover;" />
    </a>
    </td>
    `).join('')}
    </tr></tbody></table>
    ` : ''}
    </td></tr></tbody></table>
    ` : ''}
    
    <p class="mcePastedContent"><br/></p>
    ` : ''}
    
    <p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Si tienes dudas o necesitas asesoría, contáctanos por WhatsApp.</span></span></span></span></p>
    <p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><br/></p>
    <p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Saludos,<br/></span></span></span></span><strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Mario Hans FotoRental.</span></span></span></span></strong></p>
    <p class="mcePastedContent last-child" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><br/></p>
    
    </div></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td style="padding-top:12px;padding-bottom:12px;padding-right:0;padding-left:0;border:0;border-radius:0" valign="top" class="mceLayoutContainer" id="b27"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="27"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="24" width="100%" role="presentation"><tbody><tr><td valign="top" class="mceColumn" id="mceColumnId--6" data-block-id="-6" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="border:0;border-radius:0" valign="top" class="mceSocialFollowBlockContainer" id="b-5"><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" class="mceSocialFollowBlock" data-block-id="-5"><tbody><tr><td valign="middle" align="center"><!--[if mso]><table align="left" border="0" cellspacing= "0" cellpadding="0"><tr><![endif]--><!--[if mso]><td align="center" valign="top"><![endif]--><table align="left" border="0" cellpadding="0" cellspacing="0" style="display:inline;float:left" role="presentation"><tbody><tr><td style="padding-top:3px;padding-bottom:3px;padding-left:12px;padding-right:12px" valign="top" class="mceSocialFollowIcon" align="center" width="24"><a href="https://instagram.com/mariohans" target="_blank" rel="noreferrer"><img class="mceSocialFollowImage" width="24" height="24" alt="Icono de Instagram" src="https://cdn-images.mailchimp.com/icons/social-block-v2/dark-instagram-48.png"/></a></td></tr></tbody></table><!--[if mso]></td><![endif]--><!--[if mso]><td align="center" valign="top"><![endif]--><table align="left" border="0" cellpadding="0" cellspacing="0" style="display:inline;float:left" role="presentation"><tbody><tr><td style="padding-top:3px;padding-bottom:3px;padding-left:12px;padding-right:12px" valign="top" class="mceSocialFollowIcon" align="center" width="24"><a href="https://web.whatsapp.com/send/?phone=5690818976" target="_blank" rel="noreferrer"><img class="mceSocialFollowImage" width="24" height="24" alt="Website icon" src="https://cdn-images.mailchimp.com/icons/social-block-v2/dark-link-48.png"/></a></td></tr></tbody></table><!--[if mso]></td><![endif]--><!--[if mso]></tr></table><![endif]--></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td style="background-color:transparent;padding-top:25px;padding-bottom:25px;padding-right:25px;padding-left:25px;border:0;border-radius:0" valign="top" class="mceDividerBlockContainer" id="b29"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:transparent;width:100%" role="presentation" class="mceDividerContainer" data-block-id="29"><tbody><tr><td style="min-width:100%;border-top-width:1px;border-top-style:solid;border-top-color:#000000;line-height:0;font-size:0" valign="top" class="mceDividerBlock"> </td></tr></tbody></table></td></tr>
    </tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table><!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]--></td></tr></tbody></table>
    </td>
    </tr>
    </tbody></table>
    </center>
    <script type="text/javascript"  src="/6_u7pQA2/Omr9aMG/XUvxDLm/NW/iuL9cpk4JhpJrt/EhZlAQ/cDAdQR/RLRDc"></script></body></html>`;

  return emailHtml;
}

/**
 * Validate manual email data
 */
export const validateManualEmailData = (emailData: ManualEmailData): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  if (!emailData.to) {
    errors.push('Email del destinatario es requerido');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailData.to)) {
      errors.push('Formato de email inválido');
    }
  }
  
  if (!emailData.subject || emailData.subject.trim().length === 0) {
    errors.push('Asunto del correo es requerido');
  }
  
  if (!emailData.message || emailData.message.trim().length === 0) {
    errors.push('Mensaje del correo es requerido');
  }
  
  if (!emailData.orderId || emailData.orderId <= 0) {
    errors.push('ID de orden válido es requerido');
  }
  
  if (!emailData.customerName || emailData.customerName.trim().length === 0) {
    errors.push('Nombre del cliente es requerido');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Export types (already exported above)
