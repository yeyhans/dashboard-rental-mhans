import type { APIRoute } from 'astro';
import { withAuth } from '../../../middleware/auth';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '../../../lib/rateLimit';
import { createEmailWorkerHeaders, getEmailWorkerUrl } from '../../../lib/emailWorkerService';

interface ManualEmailRequest {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    url?: string;
    filename?: string;
    type?: string;
    base64?: string;
    contentType?: string;
  }>;
  metadata?: {
    type: string;
    order_id: number;
    email_type: string;
    sent_by: string;
    sent_at: string;
  };
}


export const POST: APIRoute = withAuth(async ({ request }) => {
  // Rate limit: 10 emails por minuto
  const ip = getClientIp(request);
  const limit = checkRateLimit(ip, RATE_LIMITS.email);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);

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

    // Prevent email header injection attacks
    if (/[\r\n]/.test(to) || /[\r\n]/.test(subject)) {
      console.error('[Email] Header injection attempt detected:', { to: to.substring(0, 50), subject: subject.substring(0, 50) });
      return new Response(JSON.stringify({
        success: false,
        error: 'Caracteres no válidos en campos de email'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate HTML content size
    if (html && html.length > 500000) {
      return new Response(JSON.stringify({
        success: false,
        error: 'El contenido del email es demasiado grande'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Send email using Cloudflare Worker
    console.log('📤 [Backend] Sending email via Cloudflare Worker...');

    const workerResponse = await sendViaWorker(to, subject, html, metadata);
    const workerData = await workerResponse.json();

    if (workerResponse.ok && workerData.success) {
      console.log('✅ [Backend] Manual email sent successfully via Cloudflare Worker');

      return new Response(JSON.stringify({
        success: true,
        message: 'Manual email sent successfully (via Cloudflare Worker)',
        emailId: workerData.emailId || workerData.messageId || `worker_manual_${metadata?.order_id}_${Date.now()}`
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
    console.error('💥 [Backend] Error sending manual email:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno al enviar email'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

/**
 * Primary method using Cloudflare Worker
 */
async function sendViaWorker(
  to: string,
  subject: string,
  html: string,
  metadata?: any
): Promise<Response> {
  try {
    const requestId = crypto.randomUUID();
    const workerUrl = getEmailWorkerUrl();

    const emailPayload: any = {
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

    // Process attachments if provided
    if (metadata?.attachments && metadata.attachments.length > 0) {
      const processedAttachments = await Promise.all(
        metadata.attachments.map(async (att: any) => {
          if (att.url) {
            // Fetch content from URL
            const response = await fetch(att.url);
            if (!response.ok) {
              console.warn(`⚠️ Failed to fetch attachment: ${att.url}`);
              return null;
            }
            const arrayBuffer = await response.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            return {
              filename: att.filename || att.url.split('/').pop() || 'attachment',
              content: base64,
              contentType: att.contentType || getContentType(att.url)
            };
          } else if (att.base64) {
            return {
              filename: att.filename || 'attachment',
              content: att.base64,
              contentType: att.contentType || 'application/pdf'
            };
          }
          return null;
        })
      );

      // Filter out null attachments and add to payload
      const validAttachments = processedAttachments.filter(Boolean);
      if (validAttachments.length > 0) {
        emailPayload.attachments = validAttachments;
      }
    }

    console.log('📤 [Backend] Sending via Cloudflare Worker', { requestId, deliveryType: 'manual_email' });

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

    console.log('✅ [Backend] Manual email sent successfully via Cloudflare Worker');

    return new Response(JSON.stringify({
      success: true,
      message: 'Manual email sent successfully (via Cloudflare Worker)',
      emailId: result.emailId || result.messageId || `worker_manual_${metadata?.order_id}_${Date.now()}`
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

function getContentType(url: string): string {
  if (url.includes('.pdf')) return 'application/pdf';
  if (url.includes('.jpg') || url.includes('.jpeg')) return 'image/jpeg';
  if (url.includes('.png')) return 'image/png';
  if (url.includes('.gif')) return 'image/gif';
  return 'application/octet-stream';
}

