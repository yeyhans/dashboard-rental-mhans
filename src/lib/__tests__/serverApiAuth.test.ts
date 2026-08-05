import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInternalApiHeaders, validateFrontendApiKey } from '../serverApiAuth';

describe('server API authentication', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('validates the existing frontend server API key contract', () => {
    vi.stubEnv('FRONTEND_API_SECRET', 'frontend-secret');

    const request = new Request('https://dashboard.mariohans.cl/api/external/generate-contract-pdf', {
      headers: { 'X-API-Key': 'frontend-secret' },
    });

    expect(validateFrontendApiKey(request)).toBe(true);
  });

  it('does not treat X-Internal-Request as authentication', () => {
    vi.stubEnv('FRONTEND_API_SECRET', 'frontend-secret');

    const request = new Request('https://dashboard.mariohans.cl/api/contracts/generate-pdf', {
      headers: { 'X-Internal-Request': 'true' },
    });

    expect(validateFrontendApiKey(request)).toBe(false);
  });

  it('creates internal server caller headers without exposing the secret in public names', () => {
    vi.stubEnv('FRONTEND_API_SECRET', 'frontend-secret');

    expect(createInternalApiHeaders('req-internal')).toEqual({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-API-Key': 'frontend-secret',
      'X-Request-ID': 'req-internal',
    });
  });
});
