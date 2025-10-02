import type { APIRoute } from 'astro';

// Order Data Interface for completed orders
interface CompletedOrderData {
  id?: number;
  status: string;
  date_created?: string;
  date_completed?: string;
  customer_id: string;
  total?: string;
  
  // Billing information
  billing_first_name?: string;
  billing_last_name?: string;
  billing_company?: string;
  billing_email?: string;
  billing_phone?: string;
  
  // Project information
  order_proyecto?: string;
  order_fecha_inicio?: string;
  order_fecha_termino?: string;
  num_jornadas?: number;
  
  // Line items
  line_items?: Array<{
    name: string;
    quantity: number;
    sku?: string;
  }>;
}

interface CompletedOrderEmailRequest {
  orderData: CompletedOrderData;
  emailType: 'order_completed';
  customMessage?: string;
}

// Admin email configuration
const ADMIN_EMAIL = 'rental.mariohans@gmail.com';

// Email template generator
const generateCompletedOrderEmailTemplate = (data: CompletedOrderData, customMessage?: string): string => {
  const customerName = `${data.billing_first_name || ''} ${data.billing_last_name || ''}`.trim();
  const projectName = data.order_proyecto || 'Proyecto de Arriendo';
  const orderId = data.id;
  
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

  const totalAmount = formatCLP(data.total || '0');
  const numJornadas = data.num_jornadas || 1;
  const jornadasText = numJornadas === 1 ? 'día' : 'días';
  const startDate = data.order_fecha_inicio || 'N/A';
  const endDate = data.order_fecha_termino || 'N/A';
  const completedDate = data.date_completed ? new Date(data.date_completed).toLocaleDateString('es-CL') : new Date().toLocaleDateString('es-CL');

  const title = '✅ ¡Tu Orden ha sido Completada!';
  const mainMessage = 'Nos complace informarte que tu orden de arriendo ha sido completada exitosamente.';

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Rental Mhans - Orden Completada</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
        .line-items { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .line-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .line-item:last-child { border-bottom: none; }
        .success-badge { background: #28a745; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; display: inline-block; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${title}</h1>
          <p>Rental Mhans - Equipos de Construcción</p>
          <div class="success-badge">ORDEN COMPLETADA</div>
        </div>
        
        <div class="content">
          <p>Estimado/a <strong>${customerName || 'Cliente'}</strong>,</p>
          
          <p>${mainMessage}</p>
          
          <div class="details">
            <h3>📋 Detalles de la Orden Completada</h3>
            <p><strong>Proyecto:</strong> ${projectName}</p>
            <p><strong>Orden:</strong> #${orderId}</p>
            <p><strong>Duración:</strong> ${numJornadas} ${jornadasText}</p>
            <p><strong>Total:</strong> ${totalAmount}</p>
            <p><strong>Fechas del proyecto:</strong> ${startDate} - ${endDate}</p>
            <p><strong>Fecha de completación:</strong> ${completedDate}</p>
          </div>
          
          ${data.line_items && data.line_items.length > 0 ? `
          <div class="line-items">
            <h4>🛠️ Equipos/Servicios Entregados:</h4>
            ${data.line_items.map(item => `
              <div class="line-item">
                <span>${item.name} (x${item.quantity})</span>
                <span>${item.sku ? `SKU: ${item.sku}` : ''}</span>
              </div>
            `).join('')}
          </div>
          ` : ''}
          
          ${customMessage ? `
          <div class="details">
            <h4>💬 Mensaje Adicional:</h4>
            <p>${customMessage}</p>
          </div>
          ` : ''}
          
          <div class="details">
            <h4>✅ Estado del Proyecto:</h4>
            <p><strong>Tu proyecto ha sido completado exitosamente.</strong> Todos los equipos han sido entregados y/o retirados según lo acordado.</p>
            
            <p><strong>Próximos pasos:</strong></p>
            <ul>
              <li>Si tienes alguna consulta sobre el servicio, no dudes en contactarnos</li>
              <li>Agradecemos tu feedback sobre nuestro servicio</li>
              <li>Para futuros proyectos, estaremos disponibles para apoyarte</li>
            </ul>
          </div>
          
          <p>¡Gracias por confiar en Rental Mhans para tu proyecto!</p>
          <p>Esperamos poder servirte nuevamente en el futuro.</p>
        </div>
        
        <div class="footer">
          <p>Este es un correo automático. Si tienes consultas, contáctanos.</p>
          <p>📧 rental.mariohans@gmail.com | 📱 WhatsApp disponible</p>
          <p>© ${new Date().getFullYear()} Rental Mhans - Todos los derechos reservados</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { orderData, emailType, customMessage }: CompletedOrderEmailRequest = await request.json();
    
    console.log('📧 [Backend] Processing order completed email request:', {
      order_id: orderData?.id,
      email: orderData?.billing_email,
      emailType,
      hasCustomMessage: !!customMessage
    });
    
    // Validate required fields
    const customerEmail = orderData?.billing_email;
    const customerFirstName = orderData?.billing_first_name;
    
    if (!orderData || !customerEmail || !customerFirstName) {
      console.error('❌ [Backend] Missing required fields for order completed email:', {
        hasOrderData: !!orderData,
        hasEmail: !!customerEmail,
        hasFirstName: !!customerFirstName
      });
      
      return new Response(JSON.stringify({
        success: false,
        message: 'Missing required fields',
        error: 'orderData with billing_email and billing_first_name are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate email content
    const customerName = `${orderData.billing_first_name || ''} ${orderData.billing_last_name || ''}`.trim();
    const projectName = orderData.order_proyecto || 'Proyecto de Arriendo';
    const orderId = orderData.id;
    
    const subject = `✅ Orden Completada - ${projectName} (Orden #${orderId})`;
    
    const htmlContent = generateCompletedOrderEmailTemplate(orderData, customMessage);

    // Send email using Resend
    console.log('📤 [Backend] Sending order completed email via Resend...');
    
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(import.meta.env.RESEND_API_KEY);
      
      const { data, error } = await resend.emails.send({
        from: `Rental Mhans <ordenes@${import.meta.env.PUBLIC_EMAIL_DOMAIN || 'mail.mariohans.cl'}>`,
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

      console.log('✅ [Backend] Order completed email sent successfully via Resend:', data?.id);

      // Send backup to admin (non-blocking)
      try {
        const adminSubject = `[ORDEN COMPLETADA] ${subject}`;
        const adminHtml = generateAdminBackupEmail(orderData, customerName, customerEmail);
        
        await resend.emails.send({
          from: `Rental Mhans Admin <admin@${import.meta.env.PUBLIC_EMAIL_DOMAIN || 'mail.mariohans.cl'}>`,
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
        message: 'Order completed notification email sent successfully',
        emailId: data?.id || `backend_${orderId}_${Date.now()}`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (resendError) {
      console.error('💥 [Backend] Error with Resend service:', resendError);
      
      return new Response(JSON.stringify({
        success: false,
        message: 'Failed to send order completed email',
        error: resendError instanceof Error ? resendError.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('💥 [Backend] Error sending order completed notification email:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Internal error sending order completed email',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * Generate admin backup email with order completion details
 */
function generateAdminBackupEmail(
  data: CompletedOrderData, 
  customerName: string, 
  customerEmail: string
): string {
  const orderId = data.id;
  const projectName = data.order_proyecto || 'Proyecto de Arriendo';
  const completedDate = data.date_completed ? new Date(data.date_completed).toLocaleDateString('es-CL') : new Date().toLocaleDateString('es-CL');
  
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

  const totalAmount = formatCLP(data.total || '0');
  const numJornadas = data.num_jornadas || 1;
  const startDate = data.order_fecha_inicio || 'N/A';
  const endDate = data.order_fecha_termino || 'N/A';
  
  const customerPhone = data.billing_phone || 'N/A';
  const customerCompany = data.billing_company || '';

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Orden Completada - Admin Backup</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .section { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #28a745; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 15px 0; }
        .info-item { background: #f8f9fa; padding: 10px; border-radius: 5px; }
        .info-label { font-weight: bold; color: #28a745; }
        .alert { background: #d4edda; border: 1px solid #28a745; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ ORDEN COMPLETADA - RESPALDO ADMIN</h1>
          <p>Notificación automática del sistema</p>
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
            </div>
          </div>

          <div class="section">
            <h3>📋 Detalles de la Orden Completada</h3>
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
                <div class="info-label">Estado:</div>
                <div>✅ COMPLETADO</div>
              </div>
              <div class="info-item">
                <div class="info-label">Total:</div>
                <div>${totalAmount}</div>
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
                <div class="info-label">Completado:</div>
                <div>${completedDate}</div>
              </div>
            </div>
          </div>

          ${data.line_items && data.line_items.length > 0 ? `
          <div class="section">
            <h3>🛠️ Equipos/Servicios (${data.line_items.length} items)</h3>
            ${data.line_items.map(item => `
              <div class="info-item">
                <div class="info-label">${item.name}</div>
                <div>Cantidad: ${item.quantity} ${item.sku ? `| SKU: ${item.sku}` : ''}</div>
              </div>
            `).join('')}
          </div>
          ` : ''}

          <div class="section">
            <h3>⚡ Acciones de Seguimiento</h3>
            <ul>
              <li><strong>Confirmar satisfacción del cliente</strong> - Llamar para verificar que todo estuvo correcto</li>
              <li><strong>Solicitar feedback</strong> - Pedir opinión sobre el servicio brindado</li>
              <li><strong>Actualizar registros</strong> - Marcar equipos como disponibles en inventario</li>
              <li><strong>Facturación final</strong> - Verificar que todos los pagos estén completos</li>
              <li><strong>Oportunidades futuras</strong> - Mantener contacto para futuros proyectos</li>
            </ul>
          </div>
        </div>
        
        <div class="footer">
          <p>📧 Respaldo automático generado por el sistema</p>
          <p>🕐 Generado el ${new Date().toLocaleString('es-CL')}</p>
          <p>© ${new Date().getFullYear()} Rental Mhans - Sistema de Gestión de Órdenes</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
