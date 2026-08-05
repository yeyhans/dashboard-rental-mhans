import { afterEach, describe, expect, it, vi } from 'vitest';

const from = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from })),
}));

describe('orderPdfGenerationService internal budget API caller', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sends the server-only API key and request ID to the protected budget route', async () => {
    vi.stubEnv('FRONTEND_API_SECRET', 'frontend-secret');
    vi.stubEnv('PUBLIC_SITE_URL', 'https://dashboard.mariohans.cl');
    vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role');
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: 321,
              customer_id: '42',
              billing_email: 'cliente@example.com',
              order_proyecto: 'Demo',
            },
            error: null,
          }),
        }),
      }),
    });
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ success: true, pdfUrl: 'https://example.com/budget.pdf' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const { generateBudgetPdfFromId } = await import('../orderPdfGenerationService');

    const result = await generateBudgetPdfFromId(321, true, true);

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://dashboard.mariohans.cl/api/order/generate-budget-pdf');
    expect(init.headers).toEqual(expect.objectContaining({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-API-Key': 'frontend-secret',
      'X-Request-ID': expect.any(String),
    }));
  });
});
