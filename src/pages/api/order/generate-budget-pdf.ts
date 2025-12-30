import type { APIRoute } from 'astro';
import React from 'react';
import { BudgetDocument } from '../../../lib/pdf/components/budget/BudgetDocument';
import type { BudgetDocumentData } from '../../../lib/pdf/core/types';
import { generatePdfBuffer } from '../../../lib/pdf/core/pdfService';
import { formatDateDDMMAAAA, getOrderStatusInSpanish } from '../../../lib/pdf/utils/formatters';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('🚀 Budget PDF generation API called');
    
    const requestData = await request.json();
    console.log('📋 Received order data:', {
      order_id: requestData.order_id,
      customer_id: requestData.customer_id,
      billing_email: requestData.billing_email,
      project_name: requestData.project_name
    });

    const { 
      order_id: orderId, 
      customer_id,
      uploadToR2 = true,
      sendEmail = false 
    } = requestData;

    // Validate required fields
    if (!orderId || !customer_id) {
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
      // Fetch customer RUT from user_profiles table
      let customerRut = '';
      if (orderData.customer_id) {
        const { data: customerProfile } = await supabase
          .from('user_profiles')
          .select('rut')
          .eq('user_id', parseInt(orderData.customer_id))
          .single();

        if (!customerProfile) {
          // Try with auth_uid
          const { data: customerProfile2 } = await supabase
            .from('user_profiles')
            .select('rut')
            .eq('auth_uid', orderData.customer_id)
            .single();

          customerRut = customerProfile2?.rut || '';
        } else {
          customerRut = customerProfile.rut || '';
        }
      }

      // Transform orderData to BudgetDocumentData
      const shippingInfoData = orderData.shipping_lines && orderData.shipping_lines.length > 0 ? {
        method: orderData.shipping_lines[0].method_title || orderData.shipping_lines[0].method_id || 'Delivery',
        total: parseFloat(orderData.shipping_lines[0].total || '0'),
        deliveryMethod: orderData.shipping_lines[0].meta_data?.delivery_method ||
                       (orderData.shipping_lines[0].method_id === 'pickup' ? 'pickup' : 'shipping'),
        shippingAddress: orderData.shipping_lines[0].meta_data?.shipping_address,
        shippingPhone: orderData.shipping_lines[0].meta_data?.shipping_phone,
      } : undefined;

      const documentData: BudgetDocumentData = {
        orderId: orderData.id,
        billing: {
          firstName: orderData.billing?.first_name || orderData.billing_first_name || '',
          lastName: orderData.billing?.last_name || orderData.billing_last_name || '',
          email: orderData.billing?.email || orderData.billing_email || '',
          phone: orderData.billing?.phone || orderData.billing_phone,
          company: orderData.billing?.company || orderData.billing_company,
          address: orderData.billing?.address_1 || orderData.billing_address_1,
          city: orderData.billing?.city || orderData.billing_city,
          rut: customerRut,
        },
        project: {
          name: orderData.metadata?.order_proyecto || orderData.order_proyecto || 'Proyecto de Arriendo',
          startDate: formatDateDDMMAAAA(orderData.metadata?.order_fecha_inicio || orderData.order_fecha_inicio || ''),
          endDate: formatDateDDMMAAAA(orderData.metadata?.order_fecha_termino || orderData.order_fecha_termino || ''),
          numJornadas: parseInt(orderData.metadata?.num_jornadas || orderData.num_jornadas?.toString() || '1'),
          companyRut: orderData.metadata?.company_rut || orderData.company_rut,
          retireName: orderData.metadata?.order_retire_name || orderData.order_retire_name,
          retirePhone: orderData.metadata?.order_retire_phone || orderData.order_retire_phone,
          retireRut: orderData.metadata?.order_retire_rut || orderData.order_retire_rut,
          comments: orderData.metadata?.order_comments || orderData.order_comments,
        },
        lineItems: (orderData.line_items || []).map((item: any) => ({
          name: item.name,
          sku: item.sku,
          price: parseFloat(item.price),
          quantity: item.quantity,
        })),
        totals: {
          subtotal: parseFloat(orderData.metadata?.calculated_subtotal || orderData.calculated_subtotal?.toString() || '0'),
          discount: parseFloat(orderData.metadata?.calculated_discount || orderData.calculated_discount?.toString() || '0'),
          iva: parseFloat(orderData.metadata?.calculated_iva || orderData.calculated_iva?.toString() || '0'),
          total: parseFloat(orderData.metadata?.calculated_total || orderData.calculated_total?.toString() || '0'),
          reserve: parseFloat(orderData.metadata?.calculated_total || orderData.calculated_total?.toString() || '0') * 0.25,
        },
        couponCode: orderData.coupon_code,
        status: getOrderStatusInSpanish(orderData.status || 'on-hold'),
        ...(shippingInfoData && { shippingInfo: shippingInfoData }),
      };

      // Generate PDF using React-PDF
      pdfBuffer = await generatePdfBuffer({
        document: React.createElement(BudgetDocument, { data: documentData })
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
        // Will return base64 PDF if R2 upload is not configured
      } else {
        try {
          // Create FormData for Cloudflare Worker with proper PDF content
          const formData = new FormData();
          const fileName = `Presupuesto_${orderId}_${Date.now()}.pdf`;
          
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

            // Update order with budget PDF URL (append to history in new_pdf_on_hold_url)
            console.log('💾 Updating order with budget PDF URL...');
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(
              import.meta.env.PUBLIC_SUPABASE_URL!,
              import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY!
            );

            // Get current URL history to append new URL
            const { data: currentOrder } = await supabase
              .from('orders')
              .select('new_pdf_on_hold_url')
              .eq('id', orderId)
              .single();

            let updatedUrlHistory = finalPdfUrl;
            if (currentOrder?.new_pdf_on_hold_url) {
              // Append new URL to existing history, separated by comma
              updatedUrlHistory = `${currentOrder.new_pdf_on_hold_url},${finalPdfUrl}`;
              console.log('📝 Appending to existing URL history:', updatedUrlHistory);
            } else {
              console.log('📝 Creating new URL history:', updatedUrlHistory);
            }

            const { error: updateError } = await supabase
              .from('orders')
              .update({ 
                new_pdf_on_hold_url: updatedUrlHistory,
                date_modified: new Date().toISOString()
              })
              .eq('id', orderId);

            if (updateError) {
              console.error('⚠️ Failed to update order with budget PDF URL:', updateError);
            } else {
              console.log('✅ Order updated with budget PDF URL history');
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
    if (sendEmail && (orderData.billing?.email || orderData.billing_email)) {
      console.log('📧 Sending email notification...');
      try {
        // Send email directly using Resend (avoid internal fetch calls)
        const { Resend } = await import('resend');
        const resend = new Resend(import.meta.env.RESEND_API_KEY);
        
        // Prepare email data
        const customerEmail = orderData.billing?.email || orderData.billing_email || '';
        const customerFirstName = orderData.billing?.first_name || orderData.billing_first_name || '';
        const customerLastName = orderData.billing?.last_name || orderData.billing_last_name || '';
        const customerName = `${customerFirstName} ${customerLastName}`.trim();
        const projectName = orderData.metadata?.order_proyecto || orderData.order_proyecto || 'Proyecto de Arriendo';
        const orderId = orderData.id;
        const totalAmount = orderData.metadata?.calculated_total || orderData.calculated_total?.toString() || '0';
        
        // Format currency
        const formatCLP = (amount: string | number) => {
          const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
          return new Intl.NumberFormat('es-CL', { 
            style: 'currency', 
            currency: 'CLP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
          }).format(numAmount);
        };

        const formattedTotal = formatCLP(totalAmount);
        const numJornadas = parseInt(orderData.metadata?.num_jornadas || orderData.num_jornadas?.toString() || '1');
        const jornadasText = numJornadas === 1 ? 'día' : 'días';
        const startDate = orderData.metadata?.order_fecha_inicio || orderData.order_fecha_inicio || 'N/A';
        const endDate = orderData.metadata?.order_fecha_termino || orderData.order_fecha_termino || 'N/A';

        // Generate email HTML
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
<title>Gracias por tu solicitud. Estamos revisando la disponibilidad de los equipos que seleccionaste y te contactaremos muy pronto confirmando su disponibilidad.</title>
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
.mceColumn .mceButtonLink,
                  .mceColumn-1 .mceButtonLink, 
                  .mceColumn-2 .mceButtonLink, 
                  .mceColumn-3 .mceButtonLink,
                  .mceColumn-4 .mceButtonLink{min-width:30px;}
div[contenteditable="true"]{outline:0;}
.mceImageBorder{display:inline-block;}
.mceImageBorder img{border:0!important;}
body, #bodyTable{background-color:rgb(235, 235, 235);}
.mceText, .mcnTextContent, .mceLabel{font-family:"Source Code Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;}
.mceText, .mcnTextContent, .mceLabel{color:rgb(255, 255, 255);}
.mceText h3, .mceText p, .mceText label, .mceText input{margin-bottom:0;}
.mceSpacing-12 .mceInput + .mceErrorMessage{margin-top:-6px;}
.mceSpacing-24 .mceInput + .mceErrorMessage{margin-top:-12px;}
.mceInput{background-color:transparent;border:2px solid rgb(208, 208, 208);width:60%;color:rgb(77, 77, 77);display:block;}
.mceInput[type="radio"], .mceInput[type="checkbox"]{float:left;margin-right:12px;display:inline;width:auto!important;}
.mceLabel > .mceInput{margin-bottom:0;margin-top:2px;}
.mceLabel{display:block;}
.mceText p, .mcnTextContent p{color:rgb(255, 255, 255);font-family:"Source Code Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;font-size:16px;font-weight:normal;line-height:1.5;mso-line-height-alt:150%;text-align:center;letter-spacing:0;direction:ltr;margin:0;}
.mceText h3, .mcnTextContent h3{color:rgb(0, 0, 0);font-family:"Helvetica Neue", Helvetica, Arial, Verdana, sans-serif;font-size:20px;font-weight:bold;line-height:1.5;mso-line-height-alt:150%;text-align:center;letter-spacing:0;direction:ltr;}
.mceText a, .mcnTextContent a{color:rgb(0, 0, 0);font-style:normal;font-weight:normal;text-decoration:underline;direction:ltr;}
p.mcePastedContent, h1.mcePastedContent, h2.mcePastedContent, h3.mcePastedContent, h4.mcePastedContent{text-align:left;}
#d13 p, #d13 h1, #d13 h2, #d13 h3, #d13 h4, #d13 ul{text-align:center;}
@media only screen and (max-width: 480px) {
body, table, td, p, a, li, blockquote{-webkit-text-size-adjust:none!important;}
body{width:100%!important;min-width:100%!important;}
body.mobile-native{-webkit-user-select:none;user-select:none;transition:transform 0.2s ease-in;transform-origin:top center;}
colgroup{display:none;}
.mceLogo img, .mceImage img, .mceSocialFollowIcon img{height:auto!important;}
.mceWidthContainer{max-width:660px!important;}
.mceColumn, .mceColumn-2{display:block!important;width:100%!important;}
.mceColumn-forceSpan{display:table-cell!important;width:auto!important;}
.mceColumn-forceSpan .mceButton a{min-width:0!important;}
.mceReverseStack{display:table;width:100%;}
.mceColumn-1{display:table-footer-group;width:100%!important;}
.mceColumn-3{display:table-header-group;width:100%!important;}
.mceColumn-4{display:table-caption;width:100%!important;}
.mceKeepColumns .mceButtonLink{min-width:0;}
.mceBlockContainer, .mceSpacing-24{padding-right:16px!important;padding-left:16px!important;}
.mceBlockContainerE2E{padding-right:0;padding-left:0;}
.mceImage, .mceLogo{width:100%!important;height:auto!important;}
.mceText img{max-width:100%!important;}
.mceFooterSection .mceText, .mceFooterSection .mceText p{font-size:16px!important;line-height:140%!important;}
.mceText p{margin:0;font-size:16px!important;line-height:1.5!important;mso-line-height-alt:150%;}
.mceText h3{font-size:20px!important;line-height:1.5!important;mso-line-height-alt:150%;}
.bodyCell{padding-left:16px!important;padding-right:16px!important;}
.mceButtonContainer{width:fit-content!important;max-width:fit-content!important;}
.mceButtonLink{padding:18px 28px!important;font-size:16px!important;}
.mceDividerContainer{width:100%!important;}
#b13 .mceTextBlockContainer{padding:12px 16px!important;}
#gutterContainerId-13, #gutterContainerId-22, #gutterContainerId-25, #gutterContainerId-34{padding:0!important;}
#b20{padding:40px!important;}
#b20 table{margin-right:auto!important;float:none!important;}
#b22 .mceTextBlockContainer, #b33, #b34 .mceTextBlockContainer{padding:12px 24px!important;}
#b23 .mceDividerBlock, #b29 .mceDividerBlock{border-top-width:1px!important;}
#b23{padding:17px!important;}
#b25 .mceTextBlockContainer{padding:20px!important;}
#b29{padding:25px!important;}
#b33 table{float:none!important;margin:0 auto!important;}
#b33 .mceButtonLink{padding-top:16px!important;padding-bottom:16px!important;font-size:16px!important;}
}
@media only screen and (max-width: 640px) {
.mceClusterLayout td{padding:4px!important;}
}</style></head>
<body>
<!--*|IF:MC_PREVIEW_TEXT|*-->
<!--[if !gte mso 9]><!----><span class="mcnPreviewText" style="display:none; font-size:0px; line-height:0px; max-height:0px; max-width:0px; opacity:0; overflow:hidden; visibility:hidden; mso-hide:all;">Gracias por tu solicitud. Estamos revisando la disponibilidad de los equipos que seleccionaste y te contactaremos muy pronto confirmando su disponibilidad.</span><!--<![endif]-->
<!--*|END:IF|*-->
<div style="display: none; max-height: 0px; overflow: hidden;">͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌    ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­</div><!--MCE_TRACKING_PIXEL-->
<center>
<table border="0" cellpadding="0" cellspacing="0" height="100%" width="100%" id="bodyTable" style="background-color: rgb(235, 235, 235);">
<tbody><tr>
<td class="bodyCell" align="center" valign="top">
<table id="root" border="0" cellpadding="0" cellspacing="0" width="100%"><tbody data-block-id="4" class="mceWrapper"><tr><td style="background-color:#ebebeb" valign="top" align="center" class="mceSectionHeader"><!--[if (gte mso 9)|(IE)]><table align="center" border="0" cellspacing="0" cellpadding="0" width="660" style="width:660px;"><tr><td><![endif]--><table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:660px" role="presentation"><tbody><tr><td style="background-color:#ffffff" valign="top" class="mceWrapperInner"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="3"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0" valign="top" class="mceColumn" id="mceColumnId--9" data-block-id="-9" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="background-color:#000000;padding-top:40px;padding-bottom:40px;padding-right:40px;padding-left:40px;border:0;border-radius:0" valign="top" class="mceImageBlockContainer" align="left" id="b20"><div><!--[if !mso]><!--></div><a href="https://rental.mariohans.cl" style="display:block" target="_blank" data-block-id="20"><table align="left" border="0" cellpadding="0" cellspacing="0" width="50%" style="border-collapse:separate;margin:0;vertical-align:top;max-width:50%;width:50%;height:auto" role="presentation" data-testid="image-20"><tbody><tr><td style="border:0;border-radius:0;margin:0" valign="top"><img alt="" src="https://mcusercontent.com/9ba4e87550786c74a0e5dc97e/images/87791a39-5396-8f56-d47d-22a92f2a3afe.png" width="290" height="auto" style="display:block;max-width:100%;height:auto;border-radius:0" class="imageDropZone mceLogo"/></td></tr></tbody></table></a><div><!--<![endif]--></div><div>
<!--[if mso]>
<a href="https://rental.mariohans.cl"><span class="mceImageBorder" style="border:0;border-width:2px;vertical-align:top;margin:0"><img role="presentation" class="imageDropZone mceLogo" src="https://mcusercontent.com/9ba4e87550786c74a0e5dc97e/images/87791a39-5396-8f56-d47d-22a92f2a3afe.png" alt="" width="290" height="auto" style="display:block;max-width:290px;width:290px;height:auto"/></span></a>
<![endif]-->
</div></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table><!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]--></td></tr></tbody><tbody data-block-id="11" class="mceWrapper"><tr><td style="background-color:transparent" valign="top" align="center" class="mceSectionBody"><!--[if (gte mso 9)|(IE)]><table align="center" border="0" cellspacing="0" cellpadding="0" width="660" style="width:660px;"><tr><td><![endif]--><table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:660px" role="presentation"><tbody><tr><td style="background-color:#ffffff" valign="top" class="mceWrapperInner"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="10"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0" valign="top" class="mceColumn" id="mceColumnId--10" data-block-id="-10" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0;padding-right:0;padding-left:0" valign="top" class="mceGutterContainer" id="gutterContainerId-25"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0;padding-right:0;padding-left:0;border:0;border-radius:0" valign="top" id="b25"><table width="100%" style="border:0;background-color:transparent;border-radius:0;border-collapse:separate"><tbody><tr><td style="padding-left:20px;padding-right:20px;padding-top:20px;padding-bottom:20px" class="mceTextBlockContainer"><div data-block-id="25" class="mceText" id="d25" style="width:100%"><p style="text-align: left;" class="last-child"><span style="color:rgb(0, 0, 0);"><span style="font-size: 15px">Estamos revisando la disponibilidad.</span></span></p></div></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td style="background-color:transparent;padding-top:17px;padding-bottom:17px;padding-right:17px;padding-left:17px;border:0;border-radius:0" valign="top" class="mceDividerBlockContainer" id="b23"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:transparent;width:100%" role="presentation" class="mceDividerContainer" data-block-id="23"><tbody><tr><td style="min-width:100%;border-top-width:1px;border-top-style:solid;border-top-color:#000000;line-height:0;font-size:0" valign="top" class="mceDividerBlock"> </td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table><!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]--></td></tr></tbody><tbody data-block-id="17" class="mceWrapper"><tr><td style="background-color:transparent" valign="top" align="center" class="mceSectionFooter"><!--[if (gte mso 9)|(IE)]><table align="center" border="0" cellspacing="0" cellpadding="0" width="660" style="width:660px;"><tr><td><![endif]--><table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:660px" role="presentation"><tbody><tr><td style="background-color:#ffffff" valign="top" class="mceWrapperInner"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="16"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0" valign="top" class="mceColumn" id="mceColumnId--11" data-block-id="-11" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td valign="top" class="mceGutterContainer" id="gutterContainerId-32"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate" role="presentation"><tbody><tr><td style="padding-top:8px;padding-bottom:8px;padding-right:0;padding-left:0;border:0;border-radius:0" valign="top" class="mceLayoutContainer" id="b32"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="32" id="section_69df89062991f7cb6b4909f8c557fafb" class="mceLayout"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td valign="top" class="mceColumn" id="mceColumnId--12" data-block-id="-12" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="border:0;border-radius:0" valign="top" align="center" id="b-8"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="-8"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td valign="top" class="mceColumn" id="mceColumnId--14" data-block-id="-14" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="border:0;border-radius:0" valign="top" id="b31"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="31"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="24" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0" valign="top" class="mceColumn" id="mceColumnId-30" data-block-id="30" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0;padding-right:0;padding-left:0" valign="top" class="mceGutterContainer" id="gutterContainerId-22"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0;padding-right:0;padding-left:0;border:0;border-radius:0" valign="top" id="b22"><table width="100%" style="border:0;background-color:transparent;border-radius:0;border-collapse:separate"><tbody><tr><td style="padding-left:24px;padding-right:24px;padding-top:12px;padding-bottom:12px" class="mceTextBlockContainer"><div data-block-id="22" class="mceText" id="d22" style="width:100%"><p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Hola ${customerName},</span></span></span></span></p><p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><br/></p><p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Gracias por tu solicitud. Estamos </span></span></span></span><strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif">revisando la disponibilidad de los equipos</span></span></span></strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;"> que seleccionaste y te contactaremos muy pronto confirmando su disponibilidad.</span></span></span></span></p><p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><br/></p><p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif">Nuevo pedido</span></span></span></strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">: ${orderId}</span></span></span></span></p><h3 class="mcePastedContent last-child" style="font-variant-ligatures: normal; font-variant-caps: normal; letter-spacing: normal; orphans: 2; text-indent: 0px; text-transform: none; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; white-space: normal; background-color: rgb(255, 255, 255); text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial; line-height: 20.8px; text-align: left; display: block; margin: 0px; padding: 0px;"></h3></div></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td style="background-color:transparent;padding-top:12px;padding-bottom:12px;padding-right:24px;padding-left:24px;border:0;border-radius:0" valign="top" class="mceButtonBlockContainer" align="center" id="b33"><div><!--[if !mso]><!--></div><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" data-block-id="33" class="mceButtonContainer"><tbody><tr class="mceStandardButton"><td style="background-color:#000000;border-radius:0;text-align:center" valign="top" class="mceButton">
    <a href="${finalPdfUrl}" target="_blank" class="mceButtonLink" style="background-color:#000000;border-radius:0;border:2px solid #000000;color:#ffffff;display:block;font-family:'Helvetica Neue', Helvetica, Arial, Verdana, sans-serif;font-size:16px;font-weight:normal;font-style:normal;padding:16px 28px;text-decoration:none;text-align:center;direction:ltr;letter-spacing:0px" rel="noreferrer">Descarga el detalle del pedido aquí</a></td></tr></tbody></table><div><!--<![endif]--></div><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" data-block-id="33" class="mceButtonContainer"><tbody><tr>
<!--[if mso]>
<td align="center">
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
xmlns:w="urn:schemas-microsoft-com:office:word"
href="${finalPdfUrl}"
style="v-text-anchor:middle; width:311.45px; height:54px;"
arcsize="0%"
strokecolor="#000000"
strokeweight="2px"
fillcolor="#000000">
<v:stroke dashstyle="solid"/>
<w:anchorlock />
<center style="
color: #ffffff;
display: block;
font-family: 'Helvetica Neue', Helvetica, Arial, Verdana, sans-serif;
font-size: 16;
font-style: normal;
font-weight: normal;
letter-spacing: 0px;
text-decoration: none;
text-align: center;
direction: ltr;"
>
Descarga el detalle del pedido aquí
</center>
</v:roundrect>
</td>
<![endif]-->
</tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td style="padding-top:0;padding-bottom:0;padding-right:0;padding-left:0" valign="top" class="mceGutterContainer" id="gutterContainerId-34"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0;padding-right:0;padding-left:0;border:0;border-radius:0" valign="top" id="b34"><table width="100%" style="border:0;background-color:transparent;border-radius:0;border-collapse:separate"><tbody><tr><td style="padding-left:24px;padding-right:24px;padding-top:12px;padding-bottom:12px" class="mceTextBlockContainer"><div data-block-id="34" class="mceText" id="d34" style="width:100%"><p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:rgb(0, 0, 0);"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Si tienes alguna duda o necesitas hacer algún ajuste en tu pedido, no dudes en escribirnos.</span></span></span></span><strong><span style="color:rgb(0, 0, 0);"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;"> ¡Estamos aquí para ayudarte!</span></span></span></span></strong></p><p class="mcePastedContent"><br/></p><p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><br/></p><p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:rgb(0, 0, 0);"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Saludos,<br/></span></span></span></span><strong><span style="color:rgb(0, 0, 0);"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Mario Hans FotoRental</span></span></span></span></strong></p><p class="mcePastedContent last-child"><br/></p></div></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td style="padding-top:12px;padding-bottom:12px;padding-right:0;padding-left:0;border:0;border-radius:0" valign="top" class="mceLayoutContainer" id="b27"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="27"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="24" width="100%" role="presentation"><tbody><tr><td valign="top" class="mceColumn" id="mceColumnId--6" data-block-id="-6" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="border:0;border-radius:0" valign="top" class="mceSocialFollowBlockContainer" id="b-5"><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" class="mceSocialFollowBlock" data-block-id="-5"><tbody><tr><td valign="middle" align="center"><!--[if mso]><table align="left" border="0" cellspacing= "0" cellpadding="0"><tr><![endif]--><!--[if mso]><td align="center" valign="top"><![endif]--><table align="left" border="0" cellpadding="0" cellspacing="0" style="display:inline;float:left" role="presentation"><tbody><tr><td style="padding-top:3px;padding-bottom:3px;padding-left:12px;padding-right:12px" valign="top" class="mceSocialFollowIcon" align="center" width="24"><a href="https://instagram.com/mariohans" target="_blank" rel="noreferrer"><img class="mceSocialFollowImage" width="24" height="24" alt="Icono de Instagram" src="https://cdn-images.mailchimp.com/icons/social-block-v2/dark-instagram-48.png"/></a></td></tr></tbody></table><!--[if mso]></td><![endif]--><!--[if mso]><td align="center" valign="top"><![endif]--><table align="left" border="0" cellpadding="0" cellspacing="0" style="display:inline;float:left" role="presentation"><tbody><tr><td style="padding-top:3px;padding-bottom:3px;padding-left:12px;padding-right:12px" valign="top" class="mceSocialFollowIcon" align="center" width="24"><a href="https://web.whatsapp.com/send/?phone=5690818976" target="_blank" rel="noreferrer"><img class="mceSocialFollowImage" width="24" height="24" alt="Website icon" src="https://cdn-images.mailchimp.com/icons/social-block-v2/dark-link-48.png"/></a></td></tr></tbody></table><!--[if mso]></td><![endif]--><!--[if mso]></tr></table><![endif]--></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td style="background-color:transparent;padding-top:25px;padding-bottom:25px;padding-right:25px;padding-left:25px;border:0;border-radius:0" valign="top" class="mceDividerBlockContainer" id="b29"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:transparent;width:100%" role="presentation" class="mceDividerContainer" data-block-id="29"><tbody><tr><td style="min-width:100%;border-top-width:1px;border-top-style:solid;border-top-color:#000000;line-height:0;font-size:0" valign="top" class="mceDividerBlock"> </td></tr></tbody></table></td></tr><tr>
</tr></tbody></table></td></tr></tbody></table></td></tr><tr><td style="border:0;border-radius:0" valign="top" class="mceLayoutContainer" align="center" id="b-2"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="-2"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td valign="top" class="mceColumn" id="mceColumnId--13" data-block-id="-13" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="border:0;border-radius:0" valign="top" align="center" id="b14"><div>
</div></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table><!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]--></td></tr></tbody></table>
</td>
</tr>
</tbody></table>
</center>
<script type="text/javascript"  src="/6_u7pQA2/Omr9aMG/XUvxDLm/NW/iuL9cpk4JhpJrt/EhZlAQ/cDAdQR/RLRDc"></script></body></html>
        `;

        const subject = `✅ Presupuesto Generado - ${projectName} (Orden #${orderId})`;
        
        console.log('📧 Sending budget email with data:', {
          to: customerEmail,
          order_id: orderId,
          project_name: projectName,
          pdf_url: finalPdfUrl
        });
        
        // Fetch PDF from R2 to attach it
        console.log('📎 Fetching PDF from R2 for email attachment...');
        const pdfResponse = await fetch(finalPdfUrl);
        
        if (!pdfResponse.ok) {
          throw new Error(`Failed to fetch PDF from R2: ${pdfResponse.status}`);
        }
        
        const pdfArrayBuffer = await pdfResponse.arrayBuffer();
        const pdfBuffer = Buffer.from(pdfArrayBuffer);
        console.log('✅ PDF fetched, size:', pdfBuffer.length, 'bytes');
        
        // Send customer email with PDF attachment
        const { data, error } = await resend.emails.send({
          from: `Rental Mario Hans <presupuestos@${import.meta.env.PUBLIC_EMAIL_DOMAIN || 'mail.mariohans.cl'}>`,
          to: [customerEmail],
          subject,
          html: emailHtml,
          attachments: [
            {
              filename: `presupuesto_${orderId}_${projectName.replace(/\s+/g, '_')}.pdf`,
              content: pdfBuffer,
            },
          ],
        });

        if (error) {
          console.error('❌ Resend error:', error);
        } else {
          console.log('✅ Email notification sent successfully:', data?.id);
          
          // Send admin backup (non-blocking) with PDF attachment
          try {
            const adminSubject = `[RESPALDO ORDEN] ${subject}`;
            await resend.emails.send({
              from: `Rental Mario Hans Admin <admin@${import.meta.env.PUBLIC_EMAIL_DOMAIN || 'mail.mariohans.cl'}>`,
              to: ['rental.mariohans@gmail.com'],
              subject: adminSubject,
              html: emailHtml,
              attachments: [
                {
                  filename: `presupuesto_${orderId}_${projectName.replace(/\s+/g, '_')}.pdf`,
                  content: pdfBuffer,
                },
              ],
            });
            console.log('✅ Admin backup sent successfully');
          } catch (adminError) {
            console.warn('⚠️ Failed to send admin backup (non-critical):', adminError);
          }
        }
        
      } catch (emailError) {
        console.warn('⚠️ Email sending failed (non-critical):', emailError);
      }
    } else if (sendEmail) {
      console.warn('⚠️ Email requested but no billing email found in order data');
    }

    // If no R2 URL, provide base64 fallback
    if (!finalPdfUrl) {
      console.log('📄 No R2 URL available, using base64 fallback');
      const base64PDF = Buffer.from(pdfBuffer).toString('base64');
      finalPdfUrl = `data:application/pdf;base64,${base64PDF}`;
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Presupuesto generado exitosamente',
      pdf_url: finalPdfUrl,
      pdfUrl: finalPdfUrl,
      direct_pdf_url: `${new URL(request.url).origin}/budget-pdf/${orderId}.pdf`, // Direct PDF access for testing
      metadata: {
        order_id: orderId,
        pdfType: 'budget',
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
    console.error('💥 Error in budget PDF generation API:', error);
    
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
