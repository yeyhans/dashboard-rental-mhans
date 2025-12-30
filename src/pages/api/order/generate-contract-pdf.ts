import type { APIRoute } from 'astro';
import React from 'react';
import { ContractDocument } from '../../../lib/pdf/components/contract/ContractDocument';
import type { BudgetDocumentData } from '../../../lib/pdf/core/types';
import { generatePdfBuffer } from '../../../lib/pdf/core/pdfService';
import { formatDateDDMMAAAA, getOrderStatusInSpanish } from '../../../lib/pdf/utils/formatters';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('🚀 Contract PDF generation API called');

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
      // Fetch customer RUT and signature URL from user_profiles table
      let customerRut = '';
      let userSignatureUrl = '';
      if (orderData.customer_id) {
        const { data: customerProfile } = await supabase
          .from('user_profiles')
          .select('rut, url_firma')
          .eq('user_id', parseInt(orderData.customer_id))
          .single();

        if (!customerProfile) {
          // Try with auth_uid
          const { data: customerProfile2 } = await supabase
            .from('user_profiles')
            .select('rut, url_firma')
            .eq('auth_uid', orderData.customer_id)
            .single();

          customerRut = customerProfile2?.rut || '';
          userSignatureUrl = customerProfile2?.url_firma || '';
        } else {
          customerRut = customerProfile.rut || '';
          userSignatureUrl = customerProfile.url_firma || '';
        }
      }

      // Transform orderData to BudgetDocumentData (reused for contract)
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
        userSignatureUrl: userSignatureUrl || undefined,
      };

      // Generate PDF using React-PDF
      pdfBuffer = await generatePdfBuffer({
        document: React.createElement(ContractDocument, { data: documentData })
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
          const fileName = `Contrato_${orderId}_${Date.now()}.pdf`;

          // Create blob with explicit PDF content type and proper buffer
          const pdfBlob = new Blob([pdfBuffer], {
            type: 'application/pdf'
          });

          console.log('📦 Blob created - size:', pdfBlob.size, 'type:', pdfBlob.type);

          formData.append('file', pdfBlob, fileName);
          formData.append('userId', orderData.customer_id.toString());
          formData.append('documentType', 'contract');

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

            // Update order with contract PDF URL
            console.log('💾 Updating order with contract PDF URL...');
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(
              import.meta.env.PUBLIC_SUPABASE_URL!,
              import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY!
            );

            const { error: updateError } = await supabase
              .from('orders')
              .update({
                url_contrato: finalPdfUrl,
                date_modified: new Date().toISOString()
              })
              .eq('id', orderId);

            if (updateError) {
              console.error('⚠️ Failed to update order with contract PDF URL:', updateError);
            } else {
              console.log('✅ Order updated with contract PDF URL');
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

    return new Response(JSON.stringify({
      success: true,
      message: 'Contrato generado exitosamente',
      pdf_url: finalPdfUrl,
      contractUrl: finalPdfUrl,
      metadata: {
        order_id: orderId,
        pdfType: 'contract',
        generatedAt: new Date().toISOString(),
        projectName: orderData.metadata?.order_proyecto || orderData.order_proyecto,
        totalAmount: orderData.metadata?.calculated_total || orderData.calculated_total,
        numJornadas: orderData.metadata?.num_jornadas || orderData.num_jornadas,
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
    console.error('💥 Error in contract PDF generation API:', error);

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
