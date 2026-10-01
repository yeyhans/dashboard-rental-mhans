import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * T-036. The data-quality list and the intake-progress summary are the two observable outputs of
 * `serialised-inventory-operations/spec.md` — "Intake data quality does not block entry, but is
 * flagged" and "External dependency status is observable" (ADR-003 / O-5 tracking).
 */

const getDataQualityReport = vi.fn();
const getIntakeProgress = vi.fn();

vi.mock('../../../../middleware/auth', () => ({
  withAuth: (handler: (context: any) => Promise<Response>) => async (context: any) => {
    if (!context.locals?.user) {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 });
    }
    return handler(context);
  },
}));

vi.mock('../../../../services/serialisedAssetService', () => ({
  SerialisedAssetService: { getDataQualityReport, getIntakeProgress },
}));

const admin = { locals: { user: { id: 'admin-1', email: 'admin@x.cl', role: 'admin' } } };

describe('GET /api/inventory/data-quality', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    const request = new Request('https://dashboard.mariohans.cl/api/inventory/data-quality');
    const { GET } = await import('../data-quality');

    const response = await GET({ request, locals: {} } as never);

    expect(response.status).toBe(401);
    expect(getDataQualityReport).not.toHaveBeenCalled();
  });

  it('returns the incomplete products with the fields each one is missing', async () => {
    getDataQualityReport.mockResolvedValue({
      total: 145,
      incomplete: 2,
      products: [
        { id: 1, name: 'Profoto B10', status: 'publish', missing_fields: ['sku'] },
        { id: 2, name: 'Canon R5', status: 'publish', missing_fields: ['brands', 'stock_status'] },
      ],
    });
    const request = new Request('https://dashboard.mariohans.cl/api/inventory/data-quality');
    const { GET } = await import('../data-quality');

    const response = await GET({ request, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.incomplete).toBe(2);
    expect(payload.data.products[1].missing_fields).toEqual(['brands', 'stock_status']);
  });

  it('hides internal failures behind a generic Spanish 500', async () => {
    getDataQualityReport.mockRejectedValue(new Error('relation "products" does not exist'));
    const request = new Request('https://dashboard.mariohans.cl/api/inventory/data-quality');
    const { GET } = await import('../data-quality');

    const response = await GET({ request, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).not.toContain('relation');
  });
});

describe('GET /api/inventory/progress', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    const request = new Request('https://dashboard.mariohans.cl/api/inventory/progress');
    const { GET } = await import('../progress');

    const response = await GET({ request, locals: {} } as never);

    expect(response.status).toBe(401);
    expect(getIntakeProgress).not.toHaveBeenCalled();
  });

  it('reports covered published products against the published total', async () => {
    getIntakeProgress.mockResolvedValue({
      published_products: 120,
      products_with_assets: 30,
      total_assets: 74,
      completion_percentage: 25,
    });
    const request = new Request('https://dashboard.mariohans.cl/api/inventory/progress');
    const { GET } = await import('../progress');

    const response = await GET({ request, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual({
      published_products: 120,
      products_with_assets: 30,
      total_assets: 74,
      completion_percentage: 25,
    });
  });
});
