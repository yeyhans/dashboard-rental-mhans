import type { APIRoute } from 'astro';

interface ManualEmailRequest {
  to: string;
  subject: string;
  html: string;
  attachments?: {
    budgetUrl?: string;
    contractUrl?: string;
    customDocuments?: Array<{
      name: string;
      url: string;
      type: 'budget' | 'contract' | 'warranty' | 'other';
    }>;
  };
  metadata?: {
    type: string;
    order_id: number;
    email_type: string;
    sent_by: string;
    sent_at: string;
  };
}


export const POST: APIRoute = async ({ request }) => {
  try {
    const { to, subject, html, attachments, metadata }: ManualEmailRequest = await request.json();
    
    console.log('📧 [Backend] Processing manual email request:', {
      to,
      subject: subject?.substring(0, 50) + '...',
      order_id: metadata?.order_id,
      email_type: metadata?.email_type,
      hasAttachments: !!(attachments?.budgetUrl || attachments?.contractUrl || attachments?.customDocuments?.length)
    });
    
    // Validate required fields
    if (!to || !subject || !html) {
      console.error('❌ [Backend] Missing required fields for manual email:', {
        hasTo: !!to,
        hasSubject: !!subject,
        hasHtml: !!html
      });
      
      return new Response(JSON.stringify({
        success: false,
        message: 'Missing required fields',
        error: 'to, subject, and html are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Invalid email format',
        error: 'Invalid email address format'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Send email using Resend directly
    console.log('📤 [Backend] Sending manual email via Resend...');
    
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(import.meta.env.RESEND_API_KEY);
      
      // Prepare email data
      const emailData = {
        from: `Rental Mario Hans <noreply@${import.meta.env.PUBLIC_EMAIL_DOMAIN || 'mail.mariohans.cl'}>`,
        to: [to],
        subject,
        html,
      };

      console.log('📤 Sending email to:', to);
      console.log('📧 Subject:', subject);
      
      const { data, error } = await resend.emails.send(emailData);

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

      console.log('✅ [Backend] Manual email sent successfully via Resend:', data?.id);

      return new Response(JSON.stringify({
        success: true,
        message: 'Manual email sent successfully',
        emailId: data?.id || `manual_${metadata?.order_id}_${Date.now()}`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (resendError) {
      console.error('💥 [Backend] Error with Resend service:', resendError);
      
      // Fallback: Try via Cloudflare Worker
      console.log('🔄 [Backend] Attempting fallback via Cloudflare Worker...');
      return await sendViaWorkerFallback(to, subject, html, metadata);
    }

  } catch (error) {
    console.error('💥 [Backend] Error sending manual email:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Internal error sending manual email',
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
  metadata?: any
): Promise<Response> {
  try {
    const workerUrl = import.meta.env.PUBLIC_CLOUDFLARE_WORKER_URL || 'https://workers.mariohans.cl';
    
    const emailPayload = {
      to,
      subject,
      html,
      metadata: {
        type: 'manual_email',
        order_id: metadata?.order_id,
        email_type: metadata?.email_type || 'manual',
        sent_by: metadata?.sent_by || 'admin'
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

    console.log('✅ [Backend] Manual email sent successfully via worker fallback');

    return new Response(JSON.stringify({
      success: true,
      message: 'Manual email sent successfully (via worker)',
      emailId: result.emailId || result.messageId || `worker_manual_${metadata?.order_id}_${Date.now()}`
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

