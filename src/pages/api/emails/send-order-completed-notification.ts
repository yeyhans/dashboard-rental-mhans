import type { APIRoute } from 'astro';
import { EmailTemplateService } from '../../../lib/emailTemplateService';

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

    // Send email using Resend
    console.log('📤 [Backend] Sending order completed email via Resend...');
    
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(import.meta.env.RESEND_API_KEY);
      
      // Send email to customer
      const { data, error } = await resend.emails.send({
        from: `Rental Mario Hans <ordenes@${import.meta.env.PUBLIC_EMAIL_DOMAIN || 'mail.mariohans.cl'}>`,
        to: [customerEmail],
        subject: customerSubject,
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

      console.log('✅ [Backend] Order completed email sent successfully to customer:', data?.id);

      // Send notification to admin (same content, different subject)
      try {
        const adminSubject = `🔔 Orden #${orderId} Completada - ${customerName} - ${projectName}`;
        
        // Use the same HTML content for admin (just different subject)
        const adminHtml = htmlContent;
        
        const adminResult = await resend.emails.send({
          from: `Rental Mario Hans Admin <admin@${import.meta.env.PUBLIC_EMAIL_DOMAIN || 'mail.mariohans.cl'}>`,
          to: [ADMIN_EMAIL],
          subject: adminSubject,
          html: adminHtml,
        });
        console.log('✅ [Backend] Admin notification sent successfully to:', ADMIN_EMAIL, 'ID:', adminResult.data?.id);
      } catch (adminError) {
        console.warn('⚠️ [Backend] Failed to send admin notification (non-critical):', adminError);
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

