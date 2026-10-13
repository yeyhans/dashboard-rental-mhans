import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmailWorkerHeaders, sendEmailViaWorker, validateEmailConfig } from '../emailWorkerService';

describe('dashboard emailWorkerService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('keeps old Worker compatibility when the staged shared secret is absent', () => {
    vi.stubEnv('EMAIL_WORKER_SHARED_SECRET', '');

    expect(createEmailWorkerHeaders('req-old-worker')).toEqual({
      'Content-Type': 'application/json',
      'X-Request-ID': 'req-old-worker',
    });
  });

  it('adds bearer auth only when the staged shared secret is configured', () => {
    vi.stubEnv('EMAIL_WORKER_SHARED_SECRET', 'worker-secret');

    expect(createEmailWorkerHeaders('req-auth-worker')).toEqual({
      'Content-Type': 'application/json',
      'Authorization': 'Bearer worker-secret',
      'X-Request-ID': 'req-auth-worker',
    });
  });

  it('distinguishes old-Worker reachability from authenticated delivery readiness', async () => {
    vi.stubEnv('EMAIL_WORKER_SHARED_SECRET', '');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));

    await expect(validateEmailConfig()).resolves.toMatchObject({
      isConfigured: false,
      workerReachable: true,
      authenticatedDeliveryReady: false,
    });
  });
});

/**
 * R-09a: the sending path fails closed. Without EMAIL_WORKER_SHARED_SECRET nothing is sent — an
 * unauthenticated request to the shared worker is exactly what the staged auth rollout removes.
 */
describe('sendEmailViaWorker — fails closed without the shared secret (R-09a)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends no request and returns a typed failure', async () => {
    vi.stubEnv('EMAIL_WORKER_SHARED_SECRET', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await sendEmailViaWorker('cliente@x.cl', 'Asunto', '<p>Hola</p>');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      message: expect.stringContaining('EMAIL_WORKER_SHARED_SECRET'),
      error: 'email_worker_not_configured',
    });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Email]'),
      expect.objectContaining({ failureClass: 'email_worker_not_configured' }),
    );
  });

  it('sends with bearer auth when the secret is configured', async () => {
    vi.stubEnv('EMAIL_WORKER_SHARED_SECRET', 'worker-secret');
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    const result = await sendEmailViaWorker('cliente@x.cl', 'Asunto', '<p>Hola</p>');

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/send-email$/),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer worker-secret' }),
      }),
    );
  });
});
