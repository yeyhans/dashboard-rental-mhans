import type { APIRoute } from 'astro';
import { EmailTemplateService } from '../../../lib/emailTemplateService';
import { createEmailWorkerHeaders, getEmailWorkerUrl } from '../../../lib/emailWorkerService';
import { isFrontendApiKeyOrAdmin } from '../../../lib/serverApiAuth';

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

export const POST: APIRoute = async (context) => {
  const { request } = context;
  try {
    if (!(await isFrontendApiKeyOrAdmin(context))) {
      console.error('[POST /api/emails/send-order-completed-notification] Solicitud no autorizada');
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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
    
    const customerSubject = `✅ ¡Tu Orden ha sido Completada! - ${projectName} (Orden #${orderId})`;
    
    // Prepare data for customer email template
    const totalAmount = formatCLP(orderData.total || '0');
    const numJornadas = orderData.num_jornadas || 1;
    const startDate = orderData.order_fecha_inicio || 'N/A';
    const endDate = orderData.order_fecha_termino || 'N/A';
    const completedDate = orderData.date_completed ? new Date(orderData.date_completed).toLocaleDateString('es-CL') : new Date().toLocaleDateString('es-CL');
    
    // Generate the same HTML for both customer and admin
    const htmlContent = EmailTemplateService.generateCompletedOrderCustomerEmail({
      customerName: customerName || 'Cliente',
      projectName,
      orderId: orderId || 0,
      numJornadas,
      totalAmount,
      startDate,
      endDate,
      completedDate,
      ...(orderData.line_items && { lineItems: orderData.line_items }),
      ...(customMessage && { customMessage })
    });

    // Send email using Cloudflare Worker
    console.log('📤 [Backend] Sending order completed email via Cloudflare Worker...');

    const workerResponse = await sendViaWorker(customerEmail, customerSubject, htmlContent, orderData, 'order_completed');
    const workerData = await workerResponse.json();

    if (workerResponse.ok && workerData.success) {
      console.log('✅ [Backend] Order completed email sent successfully via Cloudflare Worker');

      return new Response(JSON.stringify({
        success: true,
        message: 'Order completed notification email sent successfully (via Cloudflare Worker)',
        emailId: workerData.emailId || workerData.messageId || `completed_${orderId}_${Date.now()}`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Worker failed - return error
    console.error('❌ [Backend] Cloudflare Worker failed, returning error (no Resend fallback)');
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to send email via Cloudflare Worker',
      error: 'Email delivery failed. Please try again or contact support.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });

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
 * Primary method using Cloudflare Worker
 */
async function sendViaWorker(
  to: string,
  subject: string,
  html: string,
  orderData: CompletedOrderData,
  emailType: string
): Promise<Response> {
  try {
    const requestId = crypto.randomUUID();
    const workerUrl = getEmailWorkerUrl();
    
    const emailPayload = {
      to,
      subject,
      html,
      metadata: {
        type: emailType,
        order_id: orderData.id,
        project_name: orderData.order_proyecto || 'Proyecto de Arriendo'
      }
    };

    console.log('📤 [Backend] Sending via Cloudflare Worker', { requestId, deliveryType: emailType });

    const response = await fetch(`${workerUrl}/send-email`, {
      method: 'POST',
      headers: {
        ...createEmailWorkerHeaders(requestId),
      },
      body: JSON.stringify(emailPayload)
    });

    if (!response.ok) {
      console.error('❌ [Backend] Cloudflare Worker error:', {
        requestId,
        failureClass: 'worker_delivery_failed',
        status: response.status,
      });
      
      return new Response(JSON.stringify({
        success: false,
        message: 'Failed to send email via Cloudflare Worker',
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
        message: 'Cloudflare Worker failed',
        error: result.message || 'Failed to send email via worker'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ [Backend] Email sent successfully via Cloudflare Worker');

    return new Response(JSON.stringify({
      success: true,
      message: 'Order notification email sent successfully (via Cloudflare Worker)',
      emailId: result.emailId || result.messageId || `worker_${orderData.id}_${Date.now()}`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 [Backend] Error in Cloudflare Worker:', error);
    
    // Return failure so we can try Resend fallback
    return new Response(JSON.stringify({
      success: false,
      message: 'Worker failed',
      error: error instanceof Error ? error.message : 'Unknown worker error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

