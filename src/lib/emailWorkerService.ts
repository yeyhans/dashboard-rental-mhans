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

const WORKER_URL = 'https://workers.mariohans.cl';

/**
 * Send email via Cloudflare Worker
 * All emails flow through the rental-contracts-worker using send_email binding
 */
export async function sendEmailViaWorker(
  to: string,
  subject: string,
  html?: string,
  attachments?: EmailPayload['attachments']
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

    const response = await fetch(`${WORKER_URL}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Worker email error:', errorText);
      return {
        success: false,
        message: 'Failed to send email via worker',
        error: errorText
      };
    }

    const result = await response.json();
    return {
      success: true,
      message: result.message || 'Email sent successfully',
      emailId: result.emailId
    };
  } catch (error) {
    console.error('💥 Error sending email via worker:', error);
    return {
      success: false,
      message: 'Error sending email',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Validate email configuration - check if worker is reachable
 */
export async function validateEmailConfig(): Promise<{
  isConfigured: boolean;
  message: string;
  details?: unknown;
}> {
  try {
    const response = await fetch(`${WORKER_URL}/health`, {
      method: 'GET'
    });

    if (response.ok) {
      return {
        isConfigured: true,
        message: 'Email service is configured and healthy'
      };
    }

    return {
      isConfigured: false,
      message: `Email service returned status ${response.status}`
    };
  } catch (error) {
    return {
      isConfigured: false,
      message: 'Email service is not available',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Export types
export type { EmailResult, EmailPayload };