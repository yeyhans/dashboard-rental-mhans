import { afterEach, describe, expect, it, vi } from 'vitest';

describe('budget email service auth boundary', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('calls the authenticated budget notification endpoint with internal auth headers', async () => {
    vi.stubEnv('FRONTEND_API_SECRET', 'frontend-secret');
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ success: true, emailId: 'email-1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const { sendBudgetGeneratedEmail } = await import('../emailService');

    const result = await sendBudgetGeneratedEmail({
      id: 123,
      customer_id: '1',
      billing_email: 'cliente@example.com',
      billing_first_name: 'Cliente',
      billing_last_name: 'Demo',
    }, 'https://example.com/budget.pdf');

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith('/api/emails/send-budget-notification', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'X-API-Key': 'frontend-secret', 'X-Request-ID': expect.any(String) }),
    }));
  });

  it('does not return fallback success when budget notification delivery fails', async () => {
    vi.stubEnv('FRONTEND_API_SECRET', 'frontend-secret');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unauthorized', { status: 401 })));
    const { sendBudgetGeneratedEmail } = await import('../emailService');

    const result = await sendBudgetGeneratedEmail({
      id: 123,
      customer_id: '1',
      billing_email: 'cliente@example.com',
      billing_first_name: 'Cliente',
      billing_last_name: 'Demo',
    }, 'https://example.com/budget.pdf');

    expect(result).toEqual(expect.objectContaining({
      success: false,
      error: 'backend_email_status_401',
    }));
  });
});
