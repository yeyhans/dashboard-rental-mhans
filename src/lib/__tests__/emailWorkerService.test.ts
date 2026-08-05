import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmailWorkerHeaders, validateEmailConfig } from '../emailWorkerService';

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
