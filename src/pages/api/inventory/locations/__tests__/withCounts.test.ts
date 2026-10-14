import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * GET /api/inventory/locations?with_counts=1 adds `unit_counts` (location id -> non-retired units
 * stored there). The counts fail soft: a database without them answers `unit_counts: null`
 * instead of failing the whole listing.
 */
const list = vi.fn();
const tree = vi.fn();
const countUnitsByLocation = vi.fn();

vi.mock('../../../../../middleware/auth', () => ({
  withAuth: (handler: (context: any) => Promise<Response>) => async (context: any) => {
    if (!context.locals?.user) {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 });
    }
    return handler(context);
  },
}));

vi.mock('../../../../../services/warehouseLocationService', () => ({
  WarehouseLocationService: { list, tree, countUnitsByLocation },
}));

const admin = { locals: { user: { id: 'auth-uuid', email: 'a@x.cl', role: 'admin' }, adminSession: { admin: { id: 7 } } } };

function request(url: string) {
  return new Request(`https://dashboard.mariohans.cl${url}`, { method: 'GET' });
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('GET /api/inventory/locations?with_counts=1', () => {
  it('adds the unit counts per location next to the list', async () => {
    list.mockResolvedValue([{ id: 'a' }]);
    countUnitsByLocation.mockResolvedValue({ a: 3 });
    const { GET } = await import('../index');

    const response = await GET({ request: request('/api/inventory/locations?with_counts=1'), ...admin } as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: { locations: [{ id: 'a' }], total: 1, unit_counts: { a: 3 } },
    });
  });

  it('answers unit_counts null when the counts cannot be read, keeping the list', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    list.mockResolvedValue([{ id: 'a' }]);
    countUnitsByLocation.mockRejectedValue(new Error('column serialised_assets.location_id does not exist'));
    const { GET } = await import('../index');

    const response = await GET({ request: request('/api/inventory/locations?with_counts=1'), ...admin } as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: { locations: [{ id: 'a' }], total: 1, unit_counts: null },
    });
  });

  it('does not count units unless asked', async () => {
    list.mockResolvedValue([]);
    const { GET } = await import('../index');

    const response = await GET({ request: request('/api/inventory/locations'), ...admin } as never);
    expect(await response.json()).toEqual({ success: true, data: { locations: [], total: 0 } });
    expect(countUnitsByLocation).not.toHaveBeenCalled();
  });
});
