import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * T-014b. The health probe built its own anon client and selected from `orders`. Migration 0001
 * enables RLS on `orders` with identity-keyed policies only, so a JWT-less anon SELECT returns
 * zero rows — no error, but also no signal — while any revoked grant turns the probe into a
 * permanent `unhealthy`. The frontend calls this before PDF generation, so it must reflect the
 * database the dashboard actually uses: the service-role client.
 */
const adminFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn(), refreshSession: vi.fn() },
    from: adminFrom,
  }),
}));

function stubProbe(result: { error: unknown }) {
  adminFrom.mockReturnValue({
    select: () => ({ limit: () => Promise.resolve({ data: [], ...result }) }),
  });
}

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    vi.stubEnv('PUBLIC_CLOUDFLARE_WORKER_URL', '');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('probes a table that survives RLS, not `orders`', async () => {
    stubProbe({ error: null });
    const { GET } = await import('../health');

    const response = await GET({} as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.services.database).toBe('healthy');
    expect(adminFrom).toHaveBeenCalledWith('products');
  });

  it('reports unhealthy when the database probe fails', async () => {
    stubProbe({ error: { message: 'connection refused' } });
    const { GET } = await import('../health');

    const response = await GET({} as never);
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.services.database).toBe('error');
  });
});
