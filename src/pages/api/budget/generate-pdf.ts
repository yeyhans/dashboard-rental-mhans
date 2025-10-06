import type { APIRoute } from 'astro';
import { sendBudgetGeneratedEmail } from '../../../lib/emailService';

// Interface for the budget data
interface BudgetData {
  order_id: number;
  customer_id: string;
  status: string;
  billing: {
    first_name: string;
    last_name: string;
    company?: string;
    address_1: string;
    city: string;
    email: string;
    phone: string;
  };
  metadata: {
    order_proyecto: string;
    order_fecha_inicio: string;
    order_fecha_termino: string;
    num_jornadas: string;
    company_rut: string;
    calculated_subtotal: string;
    calculated_discount: string;
    calculated_iva: string;
    calculated_total: string;
    order_retire_name?: string;
    order_retire_phone?: string;
    order_retire_rut?: string;
    order_comments?: string;
  };
  line_items: Array<{
    product_id: string;
    quantity: number;
    sku: string;
    price: string;
    name: string;
    image?: string;
  }>;
  coupon_code?: string;
  coupon_lines?: Array<{
    code: string;
    discount: string;
    discount_type: string;
    metadata: {
      coupon_amount: string;
      coupon_id: string;
    };
  }>;
  created_at?: string;
  updated_at?: string;
}

interface GenerateBudgetPDFRequest {
  orderData: BudgetData;
  uploadToR2?: boolean;
  sendEmail?: boolean;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { orderData, uploadToR2 = true, sendEmail = true }: GenerateBudgetPDFRequest = await request.json();
    
    console.log('🚀 Starting backend budget PDF generation for order:', orderData?.order_id);
    console.log('📋 Order data received by backend API:', {
      order_id: orderData?.order_id,
      customer_id: orderData?.customer_id,
      billing_name: `${orderData?.billing?.first_name} ${orderData?.billing?.last_name}`,
      billing_email: orderData?.billing?.email,
      project_name: orderData?.metadata?.order_proyecto,
      total: orderData?.metadata?.calculated_total,
      hasOrderData: !!orderData
    });
    
    // Validate required fields
    if (!orderData || !orderData.order_id || !orderData.customer_id || !orderData.billing?.email) {
      console.error('❌ Missing required fields:', {
        hasOrderData: !!orderData,
        order_id: orderData?.order_id,
        customer_id: orderData?.customer_id,
        billing_email: orderData?.billing?.email
      });
      
      return new Response(JSON.stringify({
        success: false,
        message: 'Campos requeridos faltantes: order_id, customer_id, billing.email'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update order with budget data to ensure it's available for the PDF template
    console.log('📝 Updating order with budget data...');
    console.log('🔍 Environment variables check:', {
      PUBLIC_SUPABASE_URL: !!import.meta.env.PUBLIC_SUPABASE_URL,
      PUBLIC_SUPABASE_ANON_KEY: !!import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
      url_value: import.meta.env.PUBLIC_SUPABASE_URL?.substring(0, 20) + '...'
    });
    
    const { createClient } = await import('@supabase/supabase-js');
    
    // Use service role key for order updates (server-side only)
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL!,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY!
    );

    // Generate PDF using Puppeteer by making internal request to the template page
    console.log('📄 Generating budget PDF using Puppeteer template...');
    const pdfResult = await generateBudgetPDFWithPuppeteer(orderData);
    
    if (!pdfResult.success) {
      return new Response(JSON.stringify({
        success: false,
        message: pdfResult.message || 'Error al generar PDF de presupuesto'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let pdfUrl = '';
    
    if (uploadToR2 && pdfResult.pdfBuffer) {
      // Upload to R2 via Cloudflare Worker
      console.log('☁️ Uploading budget PDF to R2 via worker...');
      const uploadResult = await uploadBudgetPDFToR2(pdfResult.pdfBuffer, orderData);
      
      if (!uploadResult.success) {
        console.warn('⚠️ Worker upload failed, using fallback storage method:', uploadResult.message);
        
        // Fallback: Store PDF as base64 in database temporarily
        const base64PDF = Buffer.from(pdfResult.pdfBuffer).toString('base64');
        // const timestamp = Date.now(); // For future filename generation
        // const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, ''); // For future filename generation
        
        // Create a data URL for the PDF
        pdfUrl = `data:application/pdf;base64,${base64PDF}`;
        
        console.log('📄 Using fallback PDF storage method');
        console.log('⚠️ Note: PDF stored as base64 - consider fixing R2 upload for production');
      } else {
        pdfUrl = uploadResult.url!;
        console.log('✅ Budget PDF uploaded to R2 successfully:', pdfUrl);
      }
      
      // Update order with final budget PDF URL
      const finalUpdateResult = await updateOrderWithBudgetPDF(supabase, orderData, pdfUrl);
      if (!finalUpdateResult.success) {
        console.warn('⚠️ Final order update failed:', finalUpdateResult.message);
      } else {
        console.log('✅ Order updated successfully with budget PDF URL');
      }
    }

    // Send budget email if requested
    if (sendEmail && pdfUrl) {
      console.log('📧 Sending budget notification email...');
      try {
        const emailResult = await sendBudgetNotificationEmail(orderData, pdfUrl);
        if (emailResult.success) {
          console.log('✅ Budget notification email sent successfully:', emailResult.emailId);
        } else {
          console.warn('⚠️ Failed to send budget notification email:', emailResult.error);
          // Don't fail the entire process if email fails
        }
      } catch (emailError) {
        console.warn('⚠️ Email sending error (non-critical):', emailError);
        // Email failure shouldn't break the PDF generation process
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Presupuesto PDF generado exitosamente',
      pdf_url: pdfUrl,
      budgetUrl: pdfUrl, // For compatibility
      metadata: {
        order_id: orderData.order_id,
        pages: 2,
        hasLineItems: orderData.line_items && orderData.line_items.length > 0,
        hasCoupon: !!orderData.coupon_code,
        budgetType: 'rental-quote',
        generatedAt: new Date().toISOString(),
        projectName: orderData.metadata?.order_proyecto,
        totalAmount: orderData.metadata?.calculated_total,
        numJornadas: orderData.metadata?.num_jornadas
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Error generating backend budget PDF:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Error interno al generar el presupuesto PDF',
      error: error instanceof Error ? error.message : 'Error desconocido'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * Generate HTML content for budget PDF
 */
function generateBudgetHTML(orderData: BudgetData): string {
  // Parse order data with fallbacks for all column formats
  const billing = orderData.billing || {};
  const metadata = orderData.metadata || {};
  const lineItems = orderData.line_items || [];
  const couponLines = orderData.coupon_lines || [];

  // Extract data with fallbacks (supports both nested and flat structures)
  const customerFirstName = billing.first_name || '';
  const customerLastName = billing.last_name || '';
  const customerCompany = billing.company || '';
  const customerEmail = billing.email || '';
  const customerPhone = billing.phone || '';
  const customerAddress = billing.address_1 || '';
  const customerCity = billing.city || '';
  const customerRut = (billing as any).rut || ''; // RUT field might not be in interface

  // Project information with fallbacks
  const projectName = metadata.order_proyecto || 'Proyecto de Arriendo';
  const startDate = metadata.order_fecha_inicio || '';
  const endDate = metadata.order_fecha_termino || '';
  const numJornadas = parseInt(metadata.num_jornadas || '1');
  const companyRut = metadata.company_rut || '';

  // Calculate totals with fallbacks
  const subtotal = parseFloat(metadata.calculated_subtotal || '0');
  const discount = parseFloat(metadata.calculated_discount || '0');
  const iva = parseFloat(metadata.calculated_iva || '0');
  const total = parseFloat(metadata.calculated_total || '0');
  const reserve = total * 0.25;

  // Additional order information
  const orderIdNum = orderData.order_id;
  const orderStatus = orderData.status || 'on-hold';
  const paymentMethod = 'Por definir';

  // Format currency
  const formatCLP = (amount: number) => {
    return new Intl.NumberFormat('es-CL', { 
      style: 'currency', 
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Generate current date
  const currentDate = new Date().toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Generate budget number
  const budgetNumber = `PRES-${orderIdNum}-${Date.now().toString().slice(-6)}`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Presupuesto de Arriendo - ${customerFirstName} ${customerLastName}</title>
  <style>
    body {
        font-family: Arial, sans-serif;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
        background-color: #f8f9fa;
    }
    
    .container {
        background-color: white;
        padding: 30px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    
    .header {
        text-align: center;
        margin-bottom: 30px;
        border-bottom: 3px solid #007bff;
        padding-bottom: 20px;
    }
    
    .header h1 {
        color: #007bff;
        margin: 0;
        font-size: 2.2em;
        font-weight: bold;
    }
    
    .client-info {
        background-color: #f8f9fa;
        padding: 20px;
        border-radius: 6px;
        margin-bottom: 25px;
    }
    
    .client-info h2 {
        color: #333;
        margin-top: 0;
        margin-bottom: 15px;
        font-size: 1.3em;
    }
    
    .info-row {
        display: flex;
        margin-bottom: 8px;
    }
    
    .info-label {
        font-weight: bold;
        min-width: 120px;
        color: #555;
    }
    
    .info-value {
        color: #333;
    }
    
    .project-info {
        background-color: #e3f2fd;
        padding: 20px;
        border-radius: 6px;
        margin-bottom: 25px;
    }
    
    .project-info h2 {
        color: #1976d2;
        margin-top: 0;
        margin-bottom: 15px;
        font-size: 1.3em;
    }
    
    .details-section h2 {
        color: #333;
        border-bottom: 2px solid #007bff;
        padding-bottom: 10px;
        margin-bottom: 20px;
    }
    
    .items-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 25px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .items-table th {
        background-color: #007bff;
        color: white;
        padding: 12px 8px;
        text-align: center;
        font-weight: bold;
        font-size: 0.9em;
    }
    
    .items-table td {
        padding: 12px 8px;
        text-align: center;
        border-bottom: 1px solid #ddd;
    }
    
    .items-table tr:nth-child(even) {
        background-color: #f8f9fa;
    }
    
    .items-table tr:hover {
        background-color: #e3f2fd;
    }
    
    .item-name {
        text-align: left !important;
        font-weight: 500;
    }
    
    .summary-table {
        width: 100%;
        max-width: 400px;
        margin-left: auto;
        border-collapse: collapse;
        margin-bottom: 25px;
    }
    
    .summary-table td {
        padding: 10px 15px;
        border-bottom: 1px solid #ddd;
    }
    
    .summary-label {
        font-weight: bold;
        text-align: right;
        background-color: #f8f9fa;
        color: #555;
    }
    
    .summary-value {
        text-align: right;
        font-weight: bold;
        color: #333;
    }
    
    .total-row {
        background-color: #007bff !important;
        color: white !important;
    }
    
    .reserve-row {
        background-color: #28a745 !important;
        color: white !important;
    }
    
    .company-info {
        background-color: #f1f3f4;
        padding: 20px;
        border-radius: 6px;
        margin-bottom: 25px;
        border-left: 4px solid #007bff;
    }
    
    .company-info h3 {
        margin-top: 0;
        color: #333;
        font-size: 1.2em;
    }
    
    .bank-info {
        margin-top: 15px;
    }
    
    .status-message {
        background-color: #fff3cd;
        color: #856404;
        padding: 15px;
        border-radius: 6px;
        border-left: 4px solid #ffc107;
        margin-bottom: 20px;
        font-style: italic;
    }
    
    .footer {
        text-align: center;
        color: #6c757d;
        font-size: 0.8em;
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid #ddd;
    }
    
    .currency {
        font-weight: bold;
        color: #28a745;
    }
    
    @media print {
        body {
            background-color: white;
        }
        
        .container {
            box-shadow: none;
            padding: 0;
        }
    }
</style>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>Presupuesto #${budgetNumber}</h1>
        <p style="color: #666; margin: 10px 0 0 0;">Orden #${orderIdNum} - ${currentDate}</p>
    </div>
    
    <div class="client-info">
        <h2>Información del Cliente</h2>
        <div class="info-row">
            <span class="info-label">Nombre:</span>
            <span class="info-value">${customerFirstName} ${customerLastName}</span>
        </div>
        ${customerRut ? `<div class="info-row">
            <span class="info-label">RUT:</span>
            <span class="info-value">${customerRut}</span>
        </div>` : ''}
        <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-value">${customerEmail}</span>
        </div>
        ${customerCompany ? `<div class="info-row">
            <span class="info-label">Empresa:</span>
            <span class="info-value">${customerCompany}</span>
        </div>` : ''}
        ${customerAddress ? `<div class="info-row">
            <span class="info-label">Dirección:</span>
            <span class="info-value">${customerAddress}</span>
        </div>` : ''}
        ${customerCity ? `<div class="info-row">
            <span class="info-label">Ciudad:</span>
            <span class="info-value">${customerCity}</span>
        </div>` : ''}
        ${customerPhone ? `<div class="info-row">
            <span class="info-label">Teléfono:</span>
            <span class="info-value">${customerPhone}</span>
        </div>` : ''}
    </div>
    
    <div class="project-info">
        <h2>Información del Proyecto</h2>
        <div class="info-row">
            <span class="info-label">Proyecto:</span>
            <span class="info-value">${projectName}</span>
        </div>
        ${companyRut ? `<div class="info-row">
          <span class="info-label">RUT Empresa:</span>
          <span class="info-value">${companyRut}</span>
        </div>` : ''}
        ${startDate ? `<div class="info-row">
            <span class="info-label">Fecha Inicio:</span>
            <span class="info-value">${startDate}</span>
        </div>` : ''}
        ${endDate ? `<div class="info-row">
            <span class="info-label">Fecha Término:</span>
            <span class="info-value">${endDate}</span>
        </div>` : ''}
        <div class="info-row">
            <span class="info-label">Jornadas:</span>
            <span class="info-value">${numJornadas}</span>
        </div>
    </div>
    
    <div class="details-section">
        <h2>Detalles del Presupuesto</h2>
        
        ${lineItems.length > 0 ? `
          <table class="items-table">
              <thead>
                  <tr>
                      <th>ITEM</th>
                      <th>SKU</th>
                      <th>Valor Diario</th>
                      <th>Cantidad</th>
                      <th>Jornadas</th>
                      <th>SUBTOTAL</th>
                  </tr>
              </thead>
              <tbody>
                  ${lineItems.map((item: any) => {
                    const itemPrice = parseFloat(item.price || '0');
                    const itemQuantity = parseInt(item.quantity || '1');
                    const itemSubtotal = itemPrice * itemQuantity * numJornadas;
                    
                    return `
                      <tr>
                          <td class="item-name">${item.name || 'Producto'}</td>
                          <td>${item.sku || '-'}</td>
                          <td class="currency">${formatCLP(itemPrice)}</td>
                          <td>${itemQuantity}</td>
                          <td>${numJornadas}</td>
                          <td class="currency">${formatCLP(itemSubtotal)}</td>
                      </tr>
                    `;
                  }).join('')}
              </tbody>
          </table>
        ` : `
          <div class="status-message">
            No hay productos especificados en este presupuesto.
          </div>
        `}
        
        <table class="summary-table">
            <tr>
                <td class="summary-label">Subtotal</td>
                <td class="summary-value currency">${formatCLP(subtotal)}</td>
            </tr>
            ${discount > 0 ? `
                <tr>
                    <td class="summary-label">Descuento</td>
                    <td class="summary-value currency">-${formatCLP(discount)}</td>
                </tr>
            ` : ''}
            <tr>
                <td class="summary-label">IVA (19%)</td>
                <td class="summary-value currency">${formatCLP(iva)}</td>
            </tr>
            <tr class="total-row">
                <td class="summary-label">Total</td>
                <td class="summary-value currency">${formatCLP(total)}</td>
            </tr>
            <tr class="reserve-row">
                <td class="summary-label">Reserva (25%)</td>
                <td class="summary-value currency">${formatCLP(reserve)}</td>
            </tr>
        </table>

        ${couponLines.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h3 style="color: #333; margin-bottom: 10px;">Cupones Aplicados:</h3>
            ${couponLines.map((coupon: any) => `
              <div style="background-color: #d4edda; padding: 10px; border-radius: 4px; margin-bottom: 5px;">
                <strong>Código:</strong> ${coupon.code} - 
                <strong>Descuento:</strong> ${formatCLP(parseFloat(coupon.discount || '0'))}
              </div>
            `).join('')}
          </div>
        ` : ''}
    </div>
    
    <div class="company-info">
        <h3>HANS SALINAS SpA</h3>
        <div class="info-row">
            <span class="info-label">RUT:</span>
            <span class="info-value">77.892.569-9</span>
        </div>
        <div class="bank-info">
            <div class="info-row">
                <span class="info-label">Banco:</span>
                <span class="info-value">Banco de Chile</span>
            </div>
            <div class="info-row">
                <span class="info-label">Cuenta:</span>
                <span class="info-value">FAN Emprende, Cuenta vista</span>
            </div>
            <div class="info-row">
                <span class="info-label">Número:</span>
                <span class="info-value">306024355</span>
            </div>
            <div class="info-row">
                <span class="info-label">Email:</span>
                <span class="info-value">pagos@mariohans.cl</span>
            </div>
        </div>
    </div>
    
    <div class="status-message">
      Estamos revisando la disponibilidad de los equipos que seleccionaste, muy pronto confirmando su disponibilidad.
    </div>
    
    <div class="footer">
      <p>Rental Mario Hans - Presupuesto de Arriendo | Este documento fue generado electrónicamente el ${currentDate}</p>
      <p>Estado: ${orderStatus.toUpperCase()} | Método de Pago: ${paymentMethod}</p>
    </div>
</div>
</body>
</html>
  `;
}

/**
 * Generate budget PDF using Puppeteer by making internal request to HTML template
 */
async function generateBudgetPDFWithPuppeteer(orderData: BudgetData): Promise<{
  success: boolean;
  message?: string;
  pdfBuffer?: ArrayBuffer;
}> {
  try {
    // Generate HTML directly instead of making HTTP request
    console.log('📄 Generating budget HTML directly from order data');
    
    const htmlContent = generateBudgetHTML(orderData);
    
    console.log('✅ Budget HTML generated successfully, size:', htmlContent.length, 'characters');

    // Generate PDF using our PDF service (supports both development and Vercel)
    console.log('🔄 Generating budget PDF with PDF service...');
    
    try {
      const { generatePdfFromHtml } = await import('../../../lib/pdfService');
      
      const pdfBuffer = await generatePdfFromHtml({
        htmlContent,
        format: 'A4',
        margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
        printBackground: true
      });
      
      console.log('✅ Budget PDF generated successfully with PDF service, size:', pdfBuffer.byteLength, 'bytes');

      return {
        success: true,
        pdfBuffer: pdfBuffer.buffer as ArrayBuffer
      };
    } catch (error) {
      console.error('❌ PDF service not available or failed:', error);
      return {
        success: false,
        message: 'PDF generation service failed: ' + (error instanceof Error ? error.message : 'Unknown error')
      };
    }

  } catch (error) {
    console.error('Error generating budget PDF with Puppeteer:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error desconocido al generar PDF de presupuesto'
    };
  }
}

/**
 * Upload budget PDF to R2 via Cloudflare Worker
 */
async function uploadBudgetPDFToR2(pdfBuffer: ArrayBuffer, orderData: BudgetData): Promise<{
  success: boolean;
  message?: string;
  url?: string;
}> {
  try {
    const workerUrl = import.meta.env.PUBLIC_CLOUDFLARE_WORKER_URL || 'https://workers.mariohans.cl';
    
    console.log('🔧 Debug: Worker URL:', workerUrl);
    console.log('🔧 Debug: Budget PDF buffer size:', pdfBuffer.byteLength, 'bytes');
    
    // Create FormData for file upload
    const formData = new FormData();
    const timestamp = Date.now();
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `presupuesto_${orderData.order_id}_${dateStr}_${timestamp}.pdf`;
    
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('file', pdfBlob, filename);
    formData.append('userId', orderData.order_id.toString()); // Using orderId as userId for budget PDFs
    formData.append('documentType', 'budget');
    formData.append('filePath', `budgets/${filename}`);

    console.log('🔧 Debug: Uploading budget PDF to:', `${workerUrl}/upload-pdf-only`);
    console.log('🔧 Debug: FormData entries:', {
      filename,
      orderId: orderData.order_id.toString(),
      documentType: 'budget',
      filePath: `budgets/${filename}`,
      fileSize: pdfBlob.size
    });

    const response = await fetch(`${workerUrl}/upload-pdf-only`, {
      method: 'POST',
      body: formData
    });

    console.log('🔧 Debug: Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Worker response error:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
        url: `${workerUrl}/upload-pdf-only`
      });
      
      return {
        success: false,
        message: `Error al subir PDF de presupuesto: ${response.statusText}`
      };
    }

    const result = await response.json();
    console.log('🔧 Debug: Worker response:', result);
    
    if (!result.success) {
      return {
        success: false,
        message: result.message || 'Error al subir PDF de presupuesto a R2'
      };
    }

    return {
      success: true,
      url: result.url
    };

  } catch (error) {
    console.error('💥 Error uploading budget PDF to R2:', error);
    console.error('🔧 Debug: Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error desconocido al subir PDF de presupuesto'
    };
  }
}

/**
 * Update order with budget PDF URL
 */
async function updateOrderWithBudgetPDF(supabase: any, orderData: BudgetData, pdfUrl: string): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    const updateData = {
      new_pdf_on_hold_url: pdfUrl,
      date_modified: new Date().toISOString()
    };

    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderData.order_id);

    if (error) {
      console.error('Error updating order with budget PDF URL:', error);
      return {
        success: false,
        message: `Error al actualizar orden con PDF: ${error.message}`
      };
    }

    return { success: true };

  } catch (error) {
    console.error('Error updating order with budget PDF URL:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error desconocido al actualizar orden'
    };
  }
}

/**
 * Send budget notification email using direct service call
 */
async function sendBudgetNotificationEmail(orderData: BudgetData, pdfUrl: string): Promise<{
  success: boolean;
  message: string;
  emailId?: string;
  error?: string;
}> {
  try {
    console.log('📧 Sending budget notification email to:', orderData.billing.email);
    
    console.log('📤 Calling budget email service directly...');
    
    // Call the email service directly instead of HTTP
    // orderData already has the correct BudgetEmailData structure
    const result = await sendBudgetGeneratedEmail(orderData, pdfUrl);
    
    if (result.success) {
      console.log('✅ Budget email sent successfully:', result.emailId);
      return {
        success: true,
        message: 'Budget email sent successfully',
        emailId: result.emailId || undefined
      };
    } else {
      console.error('❌ Budget email service error:', result.error);
      return {
        success: false,
        message: 'Failed to send budget email',
        error: result.error || undefined
      };
    }
    
  } catch (error) {
    console.error('💥 Error in sendBudgetNotificationEmail:', error);
    return {
      success: false,
      message: 'Error sending budget email',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
