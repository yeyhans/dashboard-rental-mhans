import type { APIRoute } from 'astro';

// Complete Order/Budget Data Interface with all required columns
interface BudgetEmailData {
  // Core order fields
  id?: number;
  order_id?: number; // For backward compatibility
  status: string;
  currency?: string;
  date_created?: string;
  date_modified?: string;
  date_completed?: string;
  date_paid?: string;
  customer_id: string;
  
  // Calculated totals
  calculated_subtotal?: string;
  calculated_discount?: string;
  calculated_iva?: string;
  calculated_total?: string;
  shipping_total?: string;
  cart_tax?: string;
  total?: string;
  total_tax?: string;
  
  // Billing information (flattened for compatibility)
  billing_first_name?: string;
  billing_last_name?: string;
  billing_company?: string;
  billing_address_1?: string;
  billing_city?: string;
  billing_email?: string;
  billing_phone?: string;
  
  // Billing object (nested for compatibility)
  billing?: {
    first_name: string;
    last_name: string;
    company?: string;
    address_1: string;
    city: string;
    email: string;
    phone: string;
  };
  
  // Project metadata (flattened for compatibility)
  order_proyecto?: string;
  order_fecha_inicio?: string;
  order_fecha_termino?: string;
  num_jornadas?: string;
  company_rut?: string;
  order_retire_name?: string;
  order_retire_phone?: string;
  order_retire_rut?: string;
  order_comments?: string;
  
  // Metadata object (nested for compatibility)
  metadata?: {
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
  
  // Line items
  line_items?: Array<{
    product_id: string;
    quantity: number;
    sku: string;
    price: string;
    name: string;
    image?: string;
  }>;
  
  // Payment information
  payment_method?: string;
  payment_method_title?: string;
  transaction_id?: string;
  order_key?: string;
  customer_ip_address?: string;
  customer_user_agent?: string;
  created_via?: string;
  customer_note?: string;
  
  // Status flags
  correo_enviado?: boolean;
  pago_completo?: boolean;
  is_editable?: boolean;
  needs_payment?: boolean;
  needs_processing?: boolean;
  
  // Additional data
  fotos_garantia?: string[];
  orden_compra?: string;
  numero_factura?: string;
  new_pdf_on_hold_url?: string;
  new_pdf_processing_url?: string;
  
  // Coupons and discounts
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
  
  // Tax and shipping lines
  tax_lines?: Array<{
    id?: number;
    rate_code?: string;
    rate_id?: number;
    label?: string;
    compound?: boolean;
    tax_total?: string;
    shipping_tax_total?: string;
  }>;
  shipping_lines?: Array<{
    id?: number;
    method_title?: string;
    method_id?: string;
    total?: string;
    total_tax?: string;
  }>;
  fee_lines?: Array<{
    id?: number;
    name?: string;
    tax_class?: string;
    tax_status?: string;
    total?: string;
    total_tax?: string;
  }>;
  
  // Refunds
  refunds?: Array<{
    id?: number;
    reason?: string;
    total?: string;
    date_created?: string;
  }>;
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

interface BudgetEmailRequest {
  budgetData: BudgetEmailData;
  budgetUrl: string;
  emailType: 'budget_generated';
  customMessage?: string;
}

// Admin email configuration
const ADMIN_EMAIL = 'rental.mariohans@gmail.com';

// Fallback template generator
const generateBudgetEmailTemplate = (data: BudgetEmailData, budgetUrl: string, customMessage?: string): string => {
  const customerName = `${data.billing?.first_name || data.billing_first_name || ''} ${data.billing?.last_name || data.billing_last_name || ''}`.trim();
  const projectName = data.metadata?.order_proyecto || data.order_proyecto || 'Proyecto de Arriendo';
  const orderId = data.order_id || data.id;
  
  // Format currency helper
  const formatCLP = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-CL', { 
      style: 'currency', 
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numAmount);
  };

  const totalAmount = formatCLP(data.metadata?.calculated_total || data.calculated_total || '0');
  const numJornadas = parseInt(data.metadata?.num_jornadas || data.num_jornadas || '1');
  const jornadasText = numJornadas === 1 ? 'día' : 'días';
  const startDate = data.metadata?.order_fecha_inicio || data.order_fecha_inicio || 'N/A';
  const endDate = data.metadata?.order_fecha_termino || data.order_fecha_termino || 'N/A';

  // Solo enviamos email de "Presupuesto Generado"
  const title = '🎉 ¡Tu Presupuesto está Listo!';
  const mainMessage = 'Hemos generado tu presupuesto personalizado para tu proyecto de arriendo.';
  const buttonText = '📄 Ver Presupuesto Completo';

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Rental Mario Hans - Presupuesto</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
        .line-items { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .line-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .line-item:last-child { border-bottom: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${title}</h1>
          <p>Rental Mario Hans - Equipos de Construcción</p>
        </div>
        
        <div class="content">
          <p>Estimado/a <strong>${customerName || 'Cliente'}</strong>,</p>
          
          <p>${mainMessage}</p>
          
          <div class="details">
            <h3>📋 Detalles del Presupuesto</h3>
            <p><strong>Proyecto:</strong> ${projectName}</p>
            <p><strong>Orden:</strong> #${orderId}</p>
            <p><strong>Duración:</strong> ${numJornadas} ${jornadasText}</p>
            <p><strong>Total:</strong> ${totalAmount}</p>
            <p><strong>Fechas:</strong> ${startDate} - ${endDate}</p>
            ${data.coupon_code ? `<p><strong>Cupón aplicado:</strong> ${data.coupon_code}</p>` : ''}
          </div>
          
          ${data.line_items && data.line_items.length > 0 ? `
          <div class="line-items">
            <h4>🛠️ Productos/Servicios:</h4>
            ${data.line_items.map(item => `
              <div class="line-item">
                <span>${item.name} (x${item.quantity})</span>
                <span>${formatCLP(parseFloat(item.price) * item.quantity)}</span>
              </div>
            `).join('')}
          </div>
          ` : ''}
          
          ${budgetUrl ? `
          <div style="text-align: center;">
            <a href="${budgetUrl}" class="button">${buttonText}</a>
          </div>
          ` : ''}
          
          ${customMessage ? `
          <div class="details">
            <h4>💬 Mensaje Adicional:</h4>
            <p>${customMessage}</p>
          </div>
          ` : ''}
          
          <p><strong>Próximos pasos:</strong></p>
          <ul>
            <li>Revisa el presupuesto detallado haciendo clic en el botón superior</li>
            <li>Si tienes alguna consulta, no dudes en contactarnos</li>
            <li>Una vez que apruebes el presupuesto, procederemos con la reserva</li>
          </ul>
          
          <p>¡Gracias por confiar en nosotros para tu proyecto!</p>
        </div>
        
        <div class="footer">
          <p>Este es un correo automático. Si tienes consultas, contáctanos.</p>
          <p>📧 rental.mariohans@gmail.com | 📱 WhatsApp disponible</p>
          <p>© ${new Date().getFullYear()} Rental Mario Hans - Todos los derechos reservados</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { budgetData, budgetUrl, emailType, customMessage }: BudgetEmailRequest = await request.json();
    
    console.log('📧 [Backend] Processing budget email request:', {
      order_id: budgetData?.order_id,
      email: budgetData?.billing?.email || budgetData?.billing_email,
      emailType,
      budgetUrl: budgetUrl?.substring(0, 50) + '...',
      hasCustomMessage: !!customMessage
    });
    
    // Validate required fields with fallbacks
    const customerEmail = budgetData?.billing?.email || budgetData?.billing_email;
    const customerFirstName = budgetData?.billing?.first_name || budgetData?.billing_first_name;
    
    if (!budgetData || !customerEmail || !customerFirstName) {
      console.error('❌ [Backend] Missing required fields for budget email:', {
        hasBudgetData: !!budgetData,
        hasEmail: !!customerEmail,
        hasFirstName: !!customerFirstName
      });
      
      return new Response(JSON.stringify({
        success: false,
        message: 'Missing required fields',
        error: 'budgetData with billing.email and billing.first_name are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate email content
    const customerName = `${budgetData.billing?.first_name || budgetData.billing_first_name || ''} ${budgetData.billing?.last_name || budgetData.billing_last_name || ''}`.trim();
    const projectName = budgetData.metadata?.order_proyecto || budgetData.order_proyecto || 'Proyecto de Arriendo';
    const orderId = budgetData.order_id || budgetData.id;
    
    // Solo enviamos email de "Presupuesto Generado"
    const subject = `✅ Presupuesto Generado - ${projectName} (Orden #${orderId})`;
    
    const htmlContent = generateBudgetEmailTemplate(budgetData, budgetUrl || '', customMessage);

    // Send email using Resend directly (backend has access to environment variables)
    console.log('📤 [Backend] Sending email via Resend...');
    
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(import.meta.env.RESEND_API_KEY);
      
      const { data, error } = await resend.emails.send({
        from: `Rental Mario Hans <noreply@${import.meta.env.PUBLIC_EMAIL_DOMAIN || 'mail.mariohans.cl'}>`,
        to: [customerEmail],
        subject,
        html: htmlContent,
      });

      if (error) {
        console.error('❌ [Backend] Resend error:', error);
        return new Response(JSON.stringify({
          success: false,
          message: 'Failed to send email via Resend',
          error: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      console.log('✅ [Backend] Email sent successfully via Resend:', data?.id);

      // Send comprehensive backup to admin (non-blocking)
      try {
        const adminSubject = `[RESPALDO ORDEN] ${subject}`;
        const adminHtml = generateAdminBackupEmail(budgetData, budgetUrl || '', customerName, customerEmail);
        
        await resend.emails.send({
          from: `Rental Mario Hans Admin <admin@${import.meta.env.PUBLIC_EMAIL_DOMAIN || 'mail.mariohans.cl'}>`,
          to: [ADMIN_EMAIL],
          subject: adminSubject,
          html: adminHtml,
        });
        console.log('✅ [Backend] Admin backup sent successfully to:', ADMIN_EMAIL);
      } catch (adminError) {
        console.warn('⚠️ [Backend] Failed to send admin backup (non-critical):', adminError);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Budget notification email sent successfully',
        emailId: data?.id || `backend_${orderId}_${Date.now()}`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (resendError) {
      console.error('💥 [Backend] Error with Resend service:', resendError);
      
      // Fallback: Try via Cloudflare Worker
      console.log('🔄 [Backend] Attempting fallback via Cloudflare Worker...');
      return await sendViaWorkerFallback(customerEmail, subject, htmlContent, budgetData, budgetUrl || '');
    }

  } catch (error) {
    console.error('💥 [Backend] Error sending budget notification email:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Internal error sending budget email',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * Fallback method using Cloudflare Worker
 */
async function sendViaWorkerFallback(
  to: string,
  subject: string,
  html: string,
  budgetData: BudgetEmailData,
  budgetUrl: string
): Promise<Response> {
  try {
    const workerUrl = import.meta.env.PUBLIC_CLOUDFLARE_WORKER_URL || 'https://workers.mariohans.cl';
    
    const emailPayload = {
      to,
      subject,
      html,
      metadata: {
        type: 'budget_notification',
        order_id: budgetData.order_id,
        project_name: budgetData.metadata?.order_proyecto || budgetData.order_proyecto || 'Proyecto de Arriendo',
        budget_url: budgetUrl
      }
    };

    console.log('📤 [Backend] Sending via worker fallback to:', to);

    const response = await fetch(`${workerUrl}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [Backend] Worker fallback error:', errorText);
      
      return new Response(JSON.stringify({
        success: false,
        message: 'Failed to send email via worker fallback',
        error: `Worker error: ${response.statusText}`
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await response.json();
    
    if (!result.success) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Worker fallback failed',
        error: result.message || 'Failed to send email via worker'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ [Backend] Email sent successfully via worker fallback');

    return new Response(JSON.stringify({
      success: true,
      message: 'Budget notification email sent successfully (via worker)',
      emailId: result.emailId || result.messageId || `worker_${budgetData.order_id}_${Date.now()}`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 [Backend] Error in worker fallback:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'All email methods failed',
      error: error instanceof Error ? error.message : 'Unknown worker error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Generate comprehensive admin backup email with full order details
 */
function generateAdminBackupEmail(
  data: BudgetEmailData, 
  budgetUrl: string, 
  customerName: string, 
  customerEmail: string
): string {
  const orderId = data.order_id || data.id;
  const projectName = data.metadata?.order_proyecto || data.order_proyecto || 'Proyecto de Arriendo';
  
  // Format currency helper
  const formatCLP = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-CL', { 
      style: 'currency', 
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numAmount);
  };

  const totalAmount = formatCLP(data.metadata?.calculated_total || data.calculated_total || '0');
  const subtotal = formatCLP(data.metadata?.calculated_subtotal || data.calculated_subtotal || '0');
  const iva = formatCLP(data.metadata?.calculated_iva || data.calculated_iva || '0');
  const discount = formatCLP(data.metadata?.calculated_discount || data.calculated_discount || '0');
  const shippingTotal = formatCLP(data.shipping_total || '0');
  
  const numJornadas = parseInt(data.metadata?.num_jornadas || data.num_jornadas || '1');
  const startDate = data.metadata?.order_fecha_inicio || data.order_fecha_inicio || 'N/A';
  const endDate = data.metadata?.order_fecha_termino || data.order_fecha_termino || 'N/A';
  
  const companyRut = data.metadata?.company_rut || data.company_rut || 'N/A';
  const customerPhone = data.billing?.phone || data.billing_phone || 'N/A';
  const customerAddress = data.billing?.address_1 || data.billing_address_1 || 'N/A';
  const customerCity = data.billing?.city || data.billing_city || 'N/A';
  const customerCompany = data.billing?.company || data.billing_company || '';

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Respaldo de Orden - Admin</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .section { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #dc2626; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 15px 0; }
        .info-item { background: #f8f9fa; padding: 10px; border-radius: 5px; }
        .info-label { font-weight: bold; color: #dc2626; }
        .line-items { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .line-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee; }
        .line-item:last-child { border-bottom: none; }
        .totals { background: #e8f4f8; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
        .total-final { font-weight: bold; font-size: 1.2em; border-top: 2px solid #dc2626; padding-top: 10px; margin-top: 10px; }
        .alert { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 10px 5px; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚨 RESPALDO DE ORDEN - ADMINISTRADOR</h1>
          <p>Copia de seguridad automática del sistema</p>
          <p><strong>Tipo:</strong> PRESUPUESTO GENERADO</p>
        </div>
        
        <div class="content">
          <div class="alert">
            <h3>📧 Notificación Enviada al Cliente</h3>
            <p><strong>Email enviado a:</strong> ${customerEmail}</p>
            <p><strong>Fecha/Hora:</strong> ${new Date().toLocaleString('es-CL')}</p>
            <p><strong>Estado:</strong> ✅ Enviado exitosamente</p>
          </div>

          <div class="section">
            <h3>👤 Información del Cliente</h3>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Nombre Completo:</div>
                <div>${customerName}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Email:</div>
                <div>${customerEmail}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Teléfono:</div>
                <div>${customerPhone}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Empresa:</div>
                <div>${customerCompany || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Dirección:</div>
                <div>${customerAddress}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Ciudad:</div>
                <div>${customerCity}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <h3>📋 Detalles de la Orden</h3>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Número de Orden:</div>
                <div>#${orderId}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Proyecto:</div>
                <div>${projectName}</div>
              </div>
              <div class="info-item">
                <div class="info-label">RUT Empresa:</div>
                <div>${companyRut}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Estado:</div>
                <div>${data.status || 'on-hold'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Fecha Inicio:</div>
                <div>${startDate}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Fecha Término:</div>
                <div>${endDate}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Duración:</div>
                <div>${numJornadas} ${numJornadas === 1 ? 'día' : 'días'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Creado:</div>
                <div>${data.created_at ? new Date(data.created_at).toLocaleString('es-CL') : 'Ahora'}</div>
              </div>
            </div>
          </div>

          ${data.line_items && data.line_items.length > 0 ? `
          <div class="section">
            <h3>🛠️ Productos/Servicios (${data.line_items.length} items)</h3>
            <div class="line-items">
              ${data.line_items.map(item => `
                <div class="line-item">
                  <div>
                    <strong>${item.name}</strong><br>
                    <small>SKU: ${item.sku || 'N/A'} | Cantidad: ${item.quantity}</small>
                  </div>
                  <div style="text-align: right;">
                    <strong>${formatCLP(parseFloat(item.price) * item.quantity)}</strong><br>
                    <small>${formatCLP(item.price)} c/u</small>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          ${data.coupon_lines && data.coupon_lines.length > 0 ? `
          <div class="section">
            <h3>🎟️ Cupones Aplicados</h3>
            ${data.coupon_lines.map(coupon => `
              <div class="info-item">
                <div class="info-label">Código:</div>
                <div>${coupon.code} (${coupon.discount_type})</div>
                <div class="info-label">Descuento:</div>
                <div>${formatCLP(coupon.discount)}</div>
              </div>
            `).join('')}
          </div>
          ` : ''}

          <div class="section">
            <h3>💰 Resumen de Costos</h3>
            <div class="totals">
              <div class="total-row">
                <span>Subtotal:</span>
                <span>${subtotal}</span>
              </div>
              ${parseFloat(discount || '0') > 0 ? `
              <div class="total-row">
                <span>Descuento:</span>
                <span>-${discount}</span>
              </div>
              ` : ''}
              ${parseFloat(shippingTotal || '0') > 0 ? `
              <div class="total-row">
                <span>Envío:</span>
                <span>${shippingTotal}</span>
              </div>
              ` : ''}
              <div class="total-row">
                <span>IVA (19%):</span>
                <span>${iva}</span>
              </div>
              <div class="total-row total-final">
                <span>TOTAL:</span>
                <span>${totalAmount}</span>
              </div>
            </div>
          </div>

          ${budgetUrl ? `
          <div class="section">
            <h3>📄 Documentos Generados</h3>
            <p><strong>Presupuesto PDF:</strong></p>
            <p><a href="${budgetUrl}" class="button">Ver Presupuesto PDF</a></p>
            <p><small>URL: ${budgetUrl}</small></p>
          </div>
          ` : ''}

          <div class="section">
            <h3>⚡ Acciones Recomendadas</h3>
            <ul>
              <li><strong>Verificar datos del cliente</strong> - Confirmar información de contacto</li>
              <li><strong>Revisar disponibilidad</strong> - Verificar stock para las fechas solicitadas</li>
              <li><strong>Contactar cliente</strong> - Llamar para confirmar detalles del proyecto</li>
              <li><strong>Preparar equipos</strong> - Coordinar logística y preparación</li>
              ${budgetUrl ? '<li><strong>Seguimiento</strong> - Verificar que el cliente recibió el presupuesto</li>' : ''}
            </ul>
          </div>
        </div>
        
        <div class="footer">
          <p>📧 Este es un respaldo automático generado por el sistema</p>
          <p>🕐 Generado el ${new Date().toLocaleString('es-CL')}</p>
          <p>© ${new Date().getFullYear()} Rental Mario Hans - Sistema de Gestión de Órdenes</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
