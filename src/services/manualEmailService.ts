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
  emailType: 'availability_confirmation' | 'order_update' | 'custom';
  
  // Document attachments
  attachments?: {
    budgetUrl?: string;
    budgetUrls?: string[]; // Support for multiple budget URLs
    contractUrl?: string;
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
      hasAttachments: !!(emailData.attachments?.budgetUrl || emailData.attachments?.budgetUrls?.length || emailData.attachments?.contractUrl || emailData.attachments?.customDocuments?.length)
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
 * Generate HTML template for manual emails
 */
function generateManualEmailTemplate(emailData: ManualEmailData): string {
  const { customerName, orderId, projectName, message, emailType, attachments } = emailData;
  
  // Email type specific styling and content
  const getEmailTypeConfig = () => {
    switch (emailType) {
      case 'availability_confirmation':
        return {
          title: '✅ Confirmación de Disponibilidad',
          headerColor: '#10b981', // green
          icon: '✅',
          subtitle: 'Confirmación de disponibilidad de productos'
        };
      case 'order_update':
        return {
          title: '📋 Actualización de Pedido',
          headerColor: '#3b82f6', // blue
          icon: '📋',
          subtitle: 'Actualización del estado de su pedido'
        };
      default:
        return {
          title: '📧 Comunicación Importante',
          headerColor: '#6366f1', // indigo
          icon: '📧',
          subtitle: 'Información sobre su pedido'
        };
    }
  };

  const config = getEmailTypeConfig();

  // Count attachments
  const budgetCount = (attachments?.budgetUrl ? 1 : 0) + (attachments?.budgetUrls?.length || 0);
  const attachmentCount = budgetCount + 
                         (attachments?.contractUrl ? 1 : 0) + 
                         (attachments?.customDocuments?.length || 0);

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Rental Mhans - Comunicación</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0; 
          padding: 0; 
          background-color: #f5f5f5;
        }
        .container { 
          max-width: 600px; 
          margin: 20px auto; 
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header { 
          background: linear-gradient(135deg, ${config.headerColor} 0%, ${config.headerColor}dd 100%); 
          color: white; 
          padding: 30px; 
          text-align: center; 
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }
        .header p {
          margin: 8px 0 0 0;
          opacity: 0.9;
          font-size: 16px;
        }
        .content { 
          padding: 30px; 
        }
        .order-info {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .order-info h3 {
          margin: 0 0 15px 0;
          color: #1e293b;
          font-size: 18px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin: 8px 0;
          padding: 8px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-label {
          font-weight: 600;
          color: #64748b;
        }
        .info-value {
          color: #1e293b;
        }
        .message-content {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-left: 4px solid ${config.headerColor};
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
          white-space: pre-wrap;
          line-height: 1.7;
        }
        .attachments {
          background: #f1f5f9;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .attachments h4 {
          margin: 0 0 15px 0;
          color: #1e293b;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .attachment-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          margin: 8px 0;
        }
        .attachment-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .attachment-icon {
          width: 32px;
          height: 32px;
          background: ${config.headerColor};
          color: white;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: bold;
        }
        .attachment-button {
          background: ${config.headerColor};
          color: white;
          padding: 8px 16px;
          text-decoration: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          transition: opacity 0.2s;
        }
        .attachment-button:hover {
          opacity: 0.9;
        }
        .footer { 
          background: #f8fafc;
          text-align: center; 
          padding: 25px; 
          border-top: 1px solid #e2e8f0; 
          color: #64748b; 
          font-size: 14px; 
        }
        .footer p {
          margin: 5px 0;
        }
        .company-info {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #e2e8f0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${config.icon} ${config.title}</h1>
          <p>${config.subtitle}</p>
        </div>
        
        <div class="content">
          <p>Estimado/a <strong>${customerName}</strong>,</p>
          
          <div class="order-info">
            <h3>📋 Información del Pedido</h3>
            <div class="info-row">
              <span class="info-label">Número de Orden:</span>
              <span class="info-value">#${orderId}</span>
            </div>
            ${projectName ? `
            <div class="info-row">
              <span class="info-label">Proyecto:</span>
              <span class="info-value">${projectName}</span>
            </div>
            ` : ''}
            <div class="info-row">
              <span class="info-label">Fecha:</span>
              <span class="info-value">${new Date().toLocaleDateString('es-CL', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</span>
            </div>
          </div>
          
          <div class="message-content">
${message}
          </div>
          
          ${attachmentCount > 0 ? `
          <div class="attachments">
            <h4>📎 Documentos Adjuntos (${attachmentCount})</h4>
            
            ${attachments?.budgetUrl ? `
            <div class="attachment-item">
              <div class="attachment-info">
                <div class="attachment-icon">💰</div>
                <div>
                  <div style="font-weight: 600;">Presupuesto</div>
                  <div style="font-size: 12px; color: #64748b;">Documento PDF con detalles de costos</div>
                </div>
              </div>
              <a href="${attachments.budgetUrl}" class="attachment-button" target="_blank">Ver Presupuesto</a>
            </div>
            ` : ''}
            
            ${attachments?.budgetUrls?.map((budgetUrl, index) => `
            <div class="attachment-item">
              <div class="attachment-info">
                <div class="attachment-icon">💰</div>
                <div>
                  <div style="font-weight: 600;">Presupuesto ${index + 1}</div>
                  <div style="font-size: 12px; color: #64748b;">Documento PDF con detalles de costos</div>
                </div>
              </div>
              <a href="${budgetUrl.trim()}" class="attachment-button" target="_blank">Ver Presupuesto ${index + 1}</a>
            </div>
            `).join('') || ''}
            
            ${attachments?.contractUrl ? `
            <div class="attachment-item">
              <div class="attachment-info">
                <div class="attachment-icon">📄</div>
                <div>
                  <div style="font-weight: 600;">Contrato</div>
                  <div style="font-size: 12px; color: #64748b;">Contrato de procesamiento</div>
                </div>
              </div>
              <a href="${attachments.contractUrl}" class="attachment-button" target="_blank">Ver Contrato</a>
            </div>
            ` : ''}
            
            ${attachments?.customDocuments?.map(doc => `
            <div class="attachment-item">
              <div class="attachment-info">
                <div class="attachment-icon">${doc.type === 'warranty' ? '📸' : '📄'}</div>
                <div>
                  <div style="font-weight: 600;">${doc.name}</div>
                  <div style="font-size: 12px; color: #64748b;">Documento adicional</div>
                </div>
              </div>
              <a href="${doc.url}" class="attachment-button" target="_blank">Ver Documento</a>
            </div>
            `).join('') || ''}
          </div>
          ` : ''}
          
          <p>Si tiene alguna consulta o necesita información adicional, no dude en contactarnos.</p>
          
          <p>Saludos cordiales,<br>
          <strong>Equipo Rental Mhans</strong></p>
        </div>
        
        <div class="footer">
          <p>Este correo fue enviado desde nuestro sistema de gestión de pedidos.</p>
          <div class="company-info">
            <p><strong>📧</strong> rental.mariohans@gmail.com</p>
            <p><strong>📱</strong> WhatsApp disponible para consultas</p>
            <p>© ${new Date().getFullYear()} Rental Mhans - Equipos de Construcción</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
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
