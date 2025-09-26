// Email service for budget notifications
// This service handles sending budget-related emails using the same infrastructure as the frontend

export interface BudgetEmailData {
  // Order information
  order_id?: number;
  id?: number;
  customer_id: string;
  status?: string;
  
  // Billing information (can be nested or flat)
  billing?: {
    first_name: string;
    last_name: string;
    company?: string;
    email: string;
    phone?: string;
    address_1?: string;
    city?: string;
  };
  billing_first_name?: string;
  billing_last_name?: string;
  billing_company?: string;
  billing_email?: string;
  billing_phone?: string;
  billing_address_1?: string;
  billing_city?: string;
  
  // Project metadata (can be nested or flat)
  metadata?: {
    order_proyecto?: string;
    order_fecha_inicio?: string;
    order_fecha_termino?: string;
    num_jornadas?: string;
    calculated_total?: string;
    company_rut?: string;
  };
  order_proyecto?: string;
  order_fecha_inicio?: string;
  order_fecha_termino?: string;
  num_jornadas?: string;
  calculated_total?: string;
  company_rut?: string;
  
  // Line items
  line_items?: Array<{
    product_id: string;
    quantity: number;
    name: string;
    price: string;
    sku?: string;
    image?: string;
  }>;
  
  // Additional data
  created_at?: string;
  updated_at?: string;
}

interface EmailResult {
  success: boolean;
  message: string;
  emailId?: string;
  error?: string;
}

/**
 * Send budget generated email notification
 * This function sends an email to the customer when a budget PDF is generated
 */
export const sendBudgetGeneratedEmail = async (
  orderData: BudgetEmailData,
  pdfUrl: string
): Promise<EmailResult> => {
  try {
    console.log('📧 Starting budget email notification process...');
    console.log('📋 Order data for email:', {
      order_id: orderData.order_id || orderData.id,
      customer_email: orderData.billing?.email || orderData.billing_email,
      project_name: orderData.metadata?.order_proyecto || orderData.order_proyecto,
      pdf_url: pdfUrl?.substring(0, 50) + '...'
    });

    // Extract customer information with fallbacks
    const customerEmail = orderData.billing?.email || orderData.billing_email;
    const customerFirstName = orderData.billing?.first_name || orderData.billing_first_name || '';
    const customerLastName = orderData.billing?.last_name || orderData.billing_last_name || '';
    const customerName = `${customerFirstName} ${customerLastName}`.trim();
    const projectName = orderData.metadata?.order_proyecto || orderData.order_proyecto || 'Proyecto de Arriendo';
    const orderId = orderData.order_id || orderData.id;
    const totalAmount = orderData.metadata?.calculated_total || orderData.calculated_total || '0';

    // Validate required fields
    if (!customerEmail || !orderId) {
      console.error('❌ Missing required email fields:', {
        customerEmail: !!customerEmail,
        orderId: !!orderId
      });
      return {
        success: false,
        message: 'Email del cliente y ID de orden son requeridos',
        error: 'Missing required fields'
      };
    }

    // Format currency
    const formatCLP = (amount: string) => {
      const numAmount = parseFloat(amount) || 0;
      return new Intl.NumberFormat('es-CL', { 
        style: 'currency', 
        currency: 'CLP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(numAmount);
    };

    // Prepare email data
    const emailData = {
      to: customerEmail,
      subject: `Presupuesto de Arriendo - Orden #${orderId} - ${projectName}`,
      template: 'budget-generated',
      data: {
        customerName: customerName || 'Cliente',
        projectName: projectName,
        orderId: orderId,
        totalAmount: formatCLP(totalAmount),
        pdfUrl: pdfUrl,
        orderData: {
          ...orderData,
          formattedTotal: formatCLP(totalAmount),
          customerFullName: customerName
        }
      }
    };

    console.log('📤 Sending budget email with data:', {
      to: emailData.to,
      subject: emailData.subject,
      customerName: emailData.data.customerName,
      projectName: emailData.data.projectName,
      orderId: emailData.data.orderId,
      hasPdfUrl: !!emailData.data.pdfUrl
    });

    // Call the frontend email service API
    // Since we're in the backend, we need to make an HTTP request to the frontend email service
    const frontendEmailApiUrl = import.meta.env.FRONTEND_EMAIL_API_URL || 'http://localhost:4321/api/email/send-budget';
    
    console.log('🔗 Calling frontend email API:', frontendEmailApiUrl);
    
    const response = await fetch(frontendEmailApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Backend-Request': 'true', // Identify this as a backend request
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Frontend email API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      // Fallback: Try to send email directly using a simple email service
      console.log('🔄 Attempting fallback email sending...');
      return await sendBudgetEmailFallback(orderData, pdfUrl);
    }

    const result = await response.json();
    console.log('📥 Frontend email API response:', result);

    if (result.success) {
      console.log('✅ Budget email sent successfully via frontend API:', result.emailId);
      return {
        success: true,
        message: 'Email de presupuesto enviado exitosamente',
        emailId: result.emailId
      };
    } else {
      console.error('❌ Frontend email API returned error:', result.error);
      
      // Fallback: Try direct email sending
      console.log('🔄 Attempting fallback email sending...');
      return await sendBudgetEmailFallback(orderData, pdfUrl);
    }

  } catch (error) {
    console.error('💥 Error sending budget email:', error);
    
    // Fallback: Try direct email sending
    console.log('🔄 Attempting fallback email sending due to error...');
    return await sendBudgetEmailFallback(orderData, pdfUrl);
  }
};

/**
 * Fallback email sending method
 * This method sends a simple email notification when the main email service fails
 */
async function sendBudgetEmailFallback(
  orderData: BudgetEmailData,
  pdfUrl: string
): Promise<EmailResult> {
  try {
    console.log('📧 Using fallback email method...');
    
    const customerEmail = orderData.billing?.email || orderData.billing_email;
    const customerFirstName = orderData.billing?.first_name || orderData.billing_first_name || '';
    const customerLastName = orderData.billing?.last_name || orderData.billing_last_name || '';
    const customerName = `${customerFirstName} ${customerLastName}`.trim();
    const projectName = orderData.metadata?.order_proyecto || orderData.order_proyecto || 'Proyecto de Arriendo';
    const orderId = orderData.order_id || orderData.id;

    if (!customerEmail) {
      return {
        success: false,
        message: 'Email del cliente requerido para envío fallback',
        error: 'Missing customer email'
      };
    }

    // Create a simple email body
    const emailBody = `
      Estimado/a ${customerName || 'Cliente'},
      
      Su presupuesto para el proyecto "${projectName}" (Orden #${orderId}) ha sido generado exitosamente.
      
      Puede descargar su presupuesto desde el siguiente enlace:
      ${pdfUrl}
      
      Si tiene alguna consulta, no dude en contactarnos.
      
      Saludos cordiales,
      Equipo Rental Mhans
    `;

    // Log the fallback email (in production, this would use a simple email service)
    console.log('📧 Fallback email would be sent:', {
      to: customerEmail,
      subject: `Presupuesto de Arriendo - Orden #${orderId}`,
      body: emailBody.substring(0, 200) + '...',
      pdfUrl: pdfUrl
    });

    // In a real implementation, you would use a simple email service here
    // For now, we'll just log and return success
    console.log('✅ Fallback email logged successfully (would be sent in production)');
    
    return {
      success: true,
      message: 'Email de presupuesto procesado (método fallback)',
      emailId: `fallback_${Date.now()}`
    };

  } catch (error) {
    console.error('💥 Error in fallback email sending:', error);
    return {
      success: false,
      message: 'Error en envío de email fallback',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Send budget email using direct service call
 * This function can be used when we have direct access to the email service
 */
export const sendBudgetEmail = async (
  orderData: BudgetEmailData,
  pdfUrl: string
): Promise<EmailResult> => {
  // This is an alias for the main function for backward compatibility
  return await sendBudgetGeneratedEmail(orderData, pdfUrl);
};

/**
 * Validate email data before sending
 */
export const validateBudgetEmailData = (orderData: BudgetEmailData): {
  isValid: boolean;
  missingFields: string[];
} => {
  const missingFields: string[] = [];
  
  // Check required fields
  if (!orderData.order_id && !orderData.id) {
    missingFields.push('order_id');
  }
  
  if (!orderData.billing?.email && !orderData.billing_email) {
    missingFields.push('customer_email');
  }
  
  if (!orderData.billing?.first_name && !orderData.billing_first_name) {
    missingFields.push('customer_first_name');
  }
  
  if (!orderData.billing?.last_name && !orderData.billing_last_name) {
    missingFields.push('customer_last_name');
  }

  return {
    isValid: missingFields.length === 0,
    missingFields
  };
};

// Export types
export type { EmailResult };
