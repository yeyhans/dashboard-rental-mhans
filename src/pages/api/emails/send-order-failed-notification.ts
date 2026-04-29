import type { APIRoute } from 'astro';
import { EmailTemplateService } from '../../../lib/emailTemplateService';

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
    
    const customerSubject = `❌ Problema con tu Orden de Arriendo - ${projectName} (Orden #${orderId})`;
    
    // Prepare data for customer email template
    const totalAmount = formatCLP(orderData.total || '0');
    const numJornadas = orderData.num_jornadas || 1;
    const startDate = orderData.order_fecha_inicio || 'N/A';
    const endDate = orderData.order_fecha_termino || 'N/A';
    const failedDate = orderData.date_modified ? new Date(orderData.date_modified).toLocaleDateString('es-CL') : new Date().toLocaleDateString('es-CL');
    
    // Generate the same HTML for both customer and admin
    const htmlContent = EmailTemplateService.generateFailedOrderCustomerEmail({
      customerName: customerName || 'Cliente',
      projectName,
      orderId: orderId || 0,
      numJornadas,
      totalAmount,
      startDate,
      endDate,
      failedDate,
      ...(orderData.line_items && { lineItems: orderData.line_items }),
      ...(customMessage && { customMessage }),
      ...(failureReason && { failureReason })
    });

    // Send email using Cloudflare Worker
    console.log('📤 [Backend] Sending order failed email via Cloudflare Worker...');

    const workerResponse = await sendViaWorker(customerEmail, customerSubject, htmlContent, orderData, 'order_failed');
    const workerData = await workerResponse.json();

    if (workerResponse.ok && workerData.success) {
      console.log('✅ [Backend] Order failed email sent successfully via Cloudflare Worker');

      return new Response(JSON.stringify({
        success: true,
        message: 'Order failed notification email sent successfully (via Cloudflare Worker)',
        emailId: workerData.emailId || workerData.messageId || `failed_${orderId}_${Date.now()}`
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
 * Primary method using Cloudflare Worker
 */
async function sendViaWorker(
  to: string,
  subject: string,
  html: string,
  orderData: FailedOrderData,
  emailType: string
): Promise<Response> {
  try {
    const workerUrl = import.meta.env.PUBLIC_CLOUDFLARE_WORKER_URL || 'https://workers.mariohans.cl';
    
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

    console.log('📤 [Backend] Sending via Cloudflare Worker to:', to);

    const response = await fetch(`${workerUrl}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [Backend] Cloudflare Worker error:', errorText);
      
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

