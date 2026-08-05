/**
 * Email Service for Dashboard - Uses Cloudflare Worker send_email binding
 * Replaces Resend for all email sending
 * 
 * All emails are sent via the rental-contracts-worker at workers.mariohans.cl
 * which uses Cloudflare's native send_email binding
 */

interface EmailResult {
  success: boolean;
  message: string;
  emailId?: string;
  error?: string;
}

interface EmailPayload {
  to: string;
  subject: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64
  }>;
  metadata?: Record<string, string>;
}

const DEFAULT_WORKER_URL = 'https://workers.mariohans.cl';

export function getEmailWorkerUrl(): string {
  const rawUrl = import.meta.env.EMAIL_WORKER_URL || import.meta.env.PUBLIC_CLOUDFLARE_WORKER_URL || DEFAULT_WORKER_URL;
  const parsed = new URL(rawUrl);
  const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !(import.meta.env.DEV && isLocalhost)) {
    throw new Error('Invalid EMAIL_WORKER_URL protocol');
  }
  return parsed.origin;
}

export function createEmailWorkerHeaders(requestId = crypto.randomUUID()): HeadersInit {
  const secret = import.meta.env.EMAIL_WORKER_SHARED_SECRET;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-ID': requestId,
  };

  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }

  return headers;
}

/**
 * Send email via Cloudflare Worker
 * All emails flow through the rental-contracts-worker using send_email binding
 */
export async function sendEmailViaWorker(
  to: string,
  subject: string,
  html?: string,
  attachments?: EmailPayload['attachments'],
  requestId = crypto.randomUUID()
): Promise<EmailResult> {
  try {
    const payload: EmailPayload = {
      to,
      subject
    };

    if (html) {
      payload.html = html;
    }

    if (attachments && attachments.length > 0) {
      payload.attachments = attachments;
    }

    const response = await fetch(`${getEmailWorkerUrl()}/send-email`, {
      method: 'POST',
      headers: createEmailWorkerHeaders(requestId),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('❌ Worker email error:', {
        requestId,
        failureClass: 'worker_delivery_failed',
        status: response.status,
      });
      return {
        success: false,
        message: 'Failed to send email via worker',
        error: `worker_status_${response.status}`
      };
    }

    const result = await response.json();
    return {
      success: true,
      message: result.message || 'Email sent successfully',
      emailId: result.emailId
    };
  } catch (error) {
    console.error('💥 Error sending email via worker:', {
      requestId,
      failureClass: 'worker_delivery_exception',
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    return {
      success: false,
      message: 'Error sending email',
      error: 'worker_delivery_exception'
    };
  }
}

/**
 * Validate email configuration - check if worker is reachable
 */
export async function validateEmailConfig(): Promise<{
  isConfigured: boolean;
  workerReachable: boolean;
  authenticatedDeliveryReady: boolean;
  message: string;
  details?: unknown;
}> {
  try {
    const hasSharedSecret = !!import.meta.env.EMAIL_WORKER_SHARED_SECRET;
    const response = await fetch(`${getEmailWorkerUrl()}/health`, {
      method: 'GET'
    });

    if (response.ok) {
      return {
        isConfigured: hasSharedSecret,
        workerReachable: true,
        authenticatedDeliveryReady: hasSharedSecret,
        message: hasSharedSecret
          ? 'Email worker is reachable and authenticated delivery is configured'
          : 'Email worker is reachable, but authenticated delivery is waiting for EMAIL_WORKER_SHARED_SECRET'
      };
    }

    return {
      isConfigured: false,
      workerReachable: false,
      authenticatedDeliveryReady: false,
      message: `Email service returned status ${response.status}`
    };
  } catch (error) {
    return {
      isConfigured: false,
      workerReachable: false,
      authenticatedDeliveryReady: false,
      message: 'Email service is not available',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Export types
export type { EmailResult, EmailPayload };
