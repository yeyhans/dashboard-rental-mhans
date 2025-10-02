import type { APIRoute } from 'astro';

// Order Data Interface for failed orders
interface FailedOrderData {
  id?: number;
  status: string;
  date_created?: string;
  date_modified?: string;
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

interface FailedOrderEmailRequest {
  orderData: FailedOrderData;
  emailType: 'order_failed';
  customMessage?: string;
  failureReason?: string;
}

// Admin email configuration
const ADMIN_EMAIL = 'rental.mariohans@gmail.com';

// Email template generator
const generateFailedOrderEmailTemplate = (data: FailedOrderData, customMessage?: string, failureReason?: string): string => {
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
  const failedDate = data.date_modified ? new Date(data.date_modified).toLocaleDateString('es-CL') : new Date().toLocaleDateString('es-CL');

  const title = '❌ Problema con tu Orden de Arriendo';
  const mainMessage = 'Lamentamos informarte que ha ocurrido un problema con tu orden de arriendo y no hemos podido procesarla correctamente.';

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Rental Mhans - Problema con Orden</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
        .line-items { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .line-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .line-item:last-child { border-bottom: none; }
        .error-badge { background: #dc2626; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; display: inline-block; margin: 10px 0; }
        .solution-box { background: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .contact-box { background: #dbeafe; border: 1px solid #3b82f6; padding: 20px; border-radius: 8px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${title}</h1>
          <p>Rental Mhans - Equipos de Construcción</p>
          <div class="error-badge">ORDEN CON PROBLEMAS</div>
        </div>
        
        <div class="content">
          <p>Estimado/a <strong>${customerName || 'Cliente'}</strong>,</p>
          
          <p>${mainMessage}</p>
          
          <div class="details">
            <h3>📋 Detalles de la Orden Afectada</h3>
            <p><strong>Proyecto:</strong> ${projectName}</p>
            <p><strong>Orden:</strong> #${orderId}</p>
            <p><strong>Duración planificada:</strong> ${numJornadas} ${jornadasText}</p>
            <p><strong>Total:</strong> ${totalAmount}</p>
            <p><strong>Fechas planificadas:</strong> ${startDate} - ${endDate}</p>
            <p><strong>Fecha del problema:</strong> ${failedDate}</p>
          </div>
          
          ${failureReason ? `
          <div class="details">
            <h4>🔍 Motivo del Problema:</h4>
            <p>${failureReason}</p>
          </div>
          ` : ''}
          
          ${data.line_items && data.line_items.length > 0 ? `
          <div class="line-items">
            <h4>🛠️ Equipos/Servicios Afectados:</h4>
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
          
          <div class="solution-box">
            <h4>🔧 ¿Qué estamos haciendo?</h4>
            <p><strong>Nuestro equipo está trabajando para resolver este problema.</strong></p>
            <ul>
              <li>Estamos revisando la disponibilidad de equipos alternativos</li>
              <li>Evaluando opciones de fechas alternativas</li>
              <li>Buscando soluciones que se ajusten a tu proyecto</li>
              <li>Te contactaremos pronto con una propuesta de solución</li>
            </ul>
          </div>
          
          <div class="contact-box">
            <h4>📞 Contacto Inmediato</h4>
            <p><strong>Necesitas resolver esto urgentemente?</strong></p>
            <p>Contáctanos directamente para buscar una solución rápida:</p>
            <ul>
              <li>📧 <strong>Email:</strong> rental.mariohans@gmail.com</li>
              <li>📱 <strong>WhatsApp:</strong> Disponible para consultas urgentes</li>
              <li>🕐 <strong>Horario:</strong> Lunes a Viernes 8:00 - 18:00</li>
            </ul>
          </div>
          
          <div class="details">
            <h4>💡 Opciones Disponibles:</h4>
            <ul>
              <li><strong>Reprogramar:</strong> Buscar nuevas fechas disponibles</li>
              <li><strong>Equipos alternativos:</strong> Ofrecer equipos similares disponibles</li>
              <li><strong>Cancelación:</strong> Reembolso completo si no encontramos solución</li>
              <li><strong>Descuento:</strong> Compensación por las molestias ocasionadas</li>
            </ul>
          </div>
          
          <p><strong>Lamentamos sinceramente las molestias ocasionadas.</strong></p>
          <p>Valoramos tu confianza en Rental Mhans y haremos todo lo posible para encontrar una solución satisfactoria.</p>
        </div>
        
        <div class="footer">
          <p>Este es un correo automático. Para respuesta inmediata, contáctanos directamente.</p>
          <p>📧 rental.mariohans@gmail.com | 📱 WhatsApp disponible</p>
          <p>© ${new Date().getFullYear()} Rental Mhans - Comprometidos con tu proyecto</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { orderData, emailType, customMessage, failureReason }: FailedOrderEmailRequest = await request.json();
    
    console.log('📧 [Backend] Processing order failed email request:', {
      order_id: orderData?.id,
      email: orderData?.billing_email,
      emailType,
      hasCustomMessage: !!customMessage,
      hasFailureReason: !!failureReason
    });
    
    // Validate required fields
    const customerEmail = orderData?.billing_email;
    const customerFirstName = orderData?.billing_first_name;
    
    if (!orderData || !customerEmail || !customerFirstName) {
      console.error('❌ [Backend] Missing required fields for order failed email:', {
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
    
    const subject = `❌ Problema con tu Orden - ${projectName} (Orden #${orderId})`;
    
    const htmlContent = generateFailedOrderEmailTemplate(orderData, customMessage, failureReason);

    // Send email using Resend
    console.log('📤 [Backend] Sending order failed email via Resend...');
    
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(import.meta.env.RESEND_API_KEY);
      
      const { data, error } = await resend.emails.send({
        from: `Rental Mhans <problemas@${import.meta.env.PUBLIC_EMAIL_DOMAIN || 'mail.mariohans.cl'}>`,
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

      console.log('✅ [Backend] Order failed email sent successfully via Resend:', data?.id);

      // Send urgent backup to admin (non-blocking)
      try {
        const adminSubject = `🚨 [ORDEN FALLIDA - URGENTE] ${subject}`;
        const adminHtml = generateAdminUrgentBackupEmail(orderData, customerName, customerEmail, failureReason);
        
        await resend.emails.send({
          from: `Rental Mhans Admin <urgente@${import.meta.env.PUBLIC_EMAIL_DOMAIN || 'mail.mariohans.cl'}>`,
          to: [ADMIN_EMAIL],
          subject: adminSubject,
          html: adminHtml,
        });
        console.log('✅ [Backend] Admin urgent backup sent successfully to:', ADMIN_EMAIL);
      } catch (adminError) {
        console.warn('⚠️ [Backend] Failed to send admin backup (non-critical):', adminError);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Order failed notification email sent successfully',
        emailId: data?.id || `backend_${orderId}_${Date.now()}`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (resendError) {
      console.error('💥 [Backend] Error with Resend service:', resendError);
      
      return new Response(JSON.stringify({
        success: false,
        message: 'Failed to send order failed email',
        error: resendError instanceof Error ? resendError.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('💥 [Backend] Error sending order failed notification email:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Internal error sending order failed email',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * Generate urgent admin backup email with failure details
 */
function generateAdminUrgentBackupEmail(
  data: FailedOrderData, 
  customerName: string, 
  customerEmail: string,
  failureReason?: string
): string {
  const orderId = data.id;
  const projectName = data.order_proyecto || 'Proyecto de Arriendo';
  const failedDate = data.date_modified ? new Date(data.date_modified).toLocaleDateString('es-CL') : new Date().toLocaleDateString('es-CL');
  
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
      <title>🚨 ORDEN FALLIDA - ACCIÓN URGENTE REQUERIDA</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .section { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #dc2626; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 15px 0; }
        .info-item { background: #f8f9fa; padding: 10px; border-radius: 5px; }
        .info-label { font-weight: bold; color: #dc2626; }
        .urgent-alert { background: #fef2f2; border: 2px solid #dc2626; padding: 20px; border-radius: 8px; margin: 15px 0; }
        .action-box { background: #fff3cd; border: 2px solid #ffc107; padding: 20px; border-radius: 8px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚨 ORDEN FALLIDA - ACCIÓN URGENTE</h1>
          <p>Notificación crítica del sistema</p>
          <p><strong>⏰ REQUIERE ATENCIÓN INMEDIATA</strong></p>
        </div>
        
        <div class="content">
          <div class="urgent-alert">
            <h3>🚨 ALERTA CRÍTICA</h3>
            <p><strong>Una orden ha fallado y el cliente ha sido notificado automáticamente.</strong></p>
            <p><strong>Email enviado a:</strong> ${customerEmail}</p>
            <p><strong>Fecha/Hora:</strong> ${new Date().toLocaleString('es-CL')}</p>
            <p><strong>Estado:</strong> ❌ ORDEN FALLIDA - REQUIERE SEGUIMIENTO URGENTE</p>
          </div>

          ${failureReason ? `
          <div class="section">
            <h3>🔍 Motivo del Fallo</h3>
            <p><strong>${failureReason}</strong></p>
          </div>
          ` : ''}

          <div class="section">
            <h3>👤 Información del Cliente (CONTACTAR URGENTE)</h3>
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
            <h3>📋 Detalles de la Orden Fallida</h3>
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
                <div>❌ FALLIDA</div>
              </div>
              <div class="info-item">
                <div class="info-label">Total en Riesgo:</div>
                <div>${totalAmount}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Fecha Inicio Planificada:</div>
                <div>${startDate}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Fecha Término Planificada:</div>
                <div>${endDate}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Duración:</div>
                <div>${numJornadas} ${numJornadas === 1 ? 'día' : 'días'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Fecha del Fallo:</div>
                <div>${failedDate}</div>
              </div>
            </div>
          </div>

          ${data.line_items && data.line_items.length > 0 ? `
          <div class="section">
            <h3>🛠️ Equipos/Servicios Afectados (${data.line_items.length} items)</h3>
            ${data.line_items.map(item => `
              <div class="info-item">
                <div class="info-label">${item.name}</div>
                <div>Cantidad: ${item.quantity} ${item.sku ? `| SKU: ${item.sku}` : ''}</div>
              </div>
            `).join('')}
          </div>
          ` : ''}

          <div class="action-box">
            <h3>⚡ ACCIONES INMEDIATAS REQUERIDAS</h3>
            <p><strong>🕐 TIEMPO CRÍTICO - Actuar en las próximas 2 horas:</strong></p>
            <ol>
              <li><strong>📞 CONTACTAR AL CLIENTE INMEDIATAMENTE</strong>
                <ul>
                  <li>Llamar a: ${customerPhone}</li>
                  <li>Email: ${customerEmail}</li>
                  <li>Explicar la situación y disculparse</li>
                </ul>
              </li>
              <li><strong>🔍 INVESTIGAR CAUSA DEL FALLO</strong>
                <ul>
                  <li>Revisar disponibilidad de equipos</li>
                  <li>Verificar problemas logísticos</li>
                  <li>Identificar conflictos de fechas</li>
                </ul>
              </li>
              <li><strong>💡 PROPONER SOLUCIONES</strong>
                <ul>
                  <li>Equipos alternativos disponibles</li>
                  <li>Fechas alternativas</li>
                  <li>Descuentos compensatorios</li>
                  <li>Servicios adicionales gratuitos</li>
                </ul>
              </li>
              <li><strong>📋 DOCUMENTAR RESOLUCIÓN</strong>
                <ul>
                  <li>Actualizar estado de la orden</li>
                  <li>Registrar acciones tomadas</li>
                  <li>Confirmar satisfacción del cliente</li>
                </ul>
              </li>
            </ol>
          </div>

          <div class="section">
            <h3>📊 Impacto del Negocio</h3>
            <ul>
              <li><strong>Valor en riesgo:</strong> ${totalAmount}</li>
              <li><strong>Reputación:</strong> Cliente puede dejar reseña negativa</li>
              <li><strong>Relación:</strong> Riesgo de perder cliente a largo plazo</li>
              <li><strong>Operaciones:</strong> Posible efecto dominó en otras órdenes</li>
            </ul>
          </div>
        </div>
        
        <div class="footer">
          <p>🚨 ALERTA AUTOMÁTICA DEL SISTEMA - REQUIERE ACCIÓN INMEDIATA</p>
          <p>🕐 Generado el ${new Date().toLocaleString('es-CL')}</p>
          <p>© ${new Date().getFullYear()} Rental Mhans - Sistema de Alertas Críticas</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
