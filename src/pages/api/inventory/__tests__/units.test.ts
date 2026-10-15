import { afterEach, describe, expect, it, vi } from 'vitest';

import { InventoryError, UNIT_ERRORS } from '../../../../lib/inventoryUnits';

/**
 * Unit endpoints (0021): per-product list and bulk intake, unit edit, archive, relocation, and the
 * per-product counts. Service behaviour is covered by the service suites.
 */
const listByProduct = vi.fn();
const bulkCreateAssets = vi.fn();
const updateAsset = vi.fn();
const archiveAsset = vi.fn();
const relocateAsset = vi.fn();
const getByProductIds = vi.fn();

vi.mock('../../../../middleware/auth', () => ({
  withAuth: (handler: (context: any) => Promise<Response>) => async (context: any) => {
    if (!context.locals?.user) {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 });
    }
    return handler(context);
  },
}));

vi.mock('../../../../services/serialisedAssetService', () => ({
  SerialisedAssetService: { listByProduct, bulkCreateAssets, updateAsset, archiveAsset },
}));
vi.mock('../../../../services/assetRelocationService', () => ({ AssetRelocationService: { relocateAsset } }));
vi.mock('../../../../services/productUnitCountsService', () => ({
  ProductUnitCountsService: { getByProductIds },
  COUNTS_MAX_PRODUCT_IDS: 200,
}));

const admin = { locals: { user: { id: 'auth-uuid', email: 'a@x.cl', role: 'admin' }, adminSession: { admin: { id: 7 } } } };

function request(url: string, method = 'GET', body?: unknown) {
  return new Request(`https://dashboard.mariohans.cl${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('GET /api/inventory/products/[productId]/units', () => {
  it('lists the units of a product', async () => {
    listByProduct.mockResolvedValue([{ id: 1, status: 'in_rental' }]);
    const { GET } = await import('../products/[productId]/units');

    const response = await GET({ request: request('/api/inventory/products/42/units'), params: { productId: '42' }, ...admin } as never);

    expect(response.status).toBe(200);
    expect(listByProduct).toHaveBeenCalledWith(42);
    expect(await response.json()).toEqual({ success: true, data: { units: [{ id: 1, status: 'in_rental' }], total: 1 } });
  });

  it('rejects a non-numeric product id', async () => {
    const { GET } = await import('../products/[productId]/units');
    const response = await GET({ request: request('/api/inventory/products/abc/units'), params: { productId: 'abc' }, ...admin } as never);
    expect(response.status).toBe(400);
    expect(listByProduct).not.toHaveBeenCalled();
  });
});

describe('POST /api/inventory/products/[productId]/units', () => {
  it('bulk-creates with the defaults from the body', async () => {
    bulkCreateAssets.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const { POST } = await import('../products/[productId]/units');

    const body = { count: 2, wear: 'new', condition: 'operational', location_id: 'loc-1', serial_prefix: 'B10', kit_code: 'K', notes: 'n' };
    const response = await POST({ request: request('/api/inventory/products/42/units', 'POST', body), params: { productId: '42' }, ...admin } as never);

    expect(response.status).toBe(201);
    expect(bulkCreateAssets).toHaveBeenCalledWith(42, 2, {
      wear: 'new',
      condition: 'operational',
      location_id: 'loc-1',
      location: null,
      serial_prefix: 'B10',
      kit_code: 'K',
      notes: 'n',
    });
    expect(await response.json()).toEqual({ success: true, data: { units: [{ id: 1 }, { id: 2 }], total: 2 } });
  });

  it('maps a serial collision to 409', async () => {
    bulkCreateAssets.mockRejectedValue(new InventoryError(`${UNIT_ERRORS.BULK_SERIAL_TAKEN}: B10-00001`, 409));
    const { POST } = await import('../products/[productId]/units');

    const response = await POST({ request: request('/api/inventory/products/42/units', 'POST', { count: 1, location: 'B' }), params: { productId: '42' }, ...admin } as never);
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('B10-00001');
  });
});

describe('PUT /api/inventory/assets/[id]', () => {
  it('forwards the patch without row_version and the expected version', async () => {
    updateAsset.mockResolvedValue({ id: 5, row_version: 3 });
    const { PUT } = await import('../assets/[id]');

    const response = await PUT({
      request: request('/api/inventory/assets/5', 'PUT', { condition: 'blocked', notes: 'x', row_version: 2 }),
      params: { id: '5' },
      ...admin,
    } as never);

    expect(response.status).toBe(200);
    expect(updateAsset).toHaveBeenCalledWith(5, { condition: 'blocked', notes: 'x' }, 2);
    expect(await response.json()).toEqual({ success: true, data: { id: 5, row_version: 3 } });
  });

  it('answers 409 CONFLICT with the reload message', async () => {
    updateAsset.mockRejectedValue(new InventoryError(UNIT_ERRORS.CONFLICT, 409));
    const { PUT } = await import('../assets/[id]');

    const response = await PUT({ request: request('/api/inventory/assets/5', 'PUT', { notes: 'x', row_version: 1 }), params: { id: '5' }, ...admin } as never);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ success: false, error: 'La unidad fue modificada por otra persona; recarga', code: 'CONFLICT' });
  });

  it('rejects a bad id', async () => {
    const { PUT } = await import('../assets/[id]');
    const response = await PUT({ request: request('/api/inventory/assets/0', 'PUT', { row_version: 1 }), params: { id: '0' }, ...admin } as never);
    expect(response.status).toBe(400);
  });
});

describe('POST /api/inventory/assets/[id]/archive', () => {
  it('archives with the expected version', async () => {
    archiveAsset.mockResolvedValue({ id: 5, condition: 'retired' });
    const { POST } = await import('../assets/[id]/archive');

    const response = await POST({ request: request('/api/inventory/assets/5/archive', 'POST', { row_version: 3 }), params: { id: '5' }, ...admin } as never);

    expect(response.status).toBe(200);
    expect(archiveAsset).toHaveBeenCalledWith(5, 3);
  });

  it('answers 409 while the unit is out on a rental', async () => {
    archiveAsset.mockRejectedValue(new InventoryError(UNIT_ERRORS.IN_RENTAL, 409));
    const { POST } = await import('../assets/[id]/archive');

    const response = await POST({ request: request('/api/inventory/assets/5/archive', 'POST', { row_version: 3 }), params: { id: '5' }, ...admin } as never);
    expect(response.status).toBe(409);
  });
});

describe('POST /api/inventory/assets/[id]/relocate', () => {
  const operator = { locals: { user: { id: 'op-uuid', email: 'o@x.cl', role: 'operator' }, adminSession: { admin: { id: 9 } } } };

  it('moves the unit as the session user with source dashboard, ignoring body overrides', async () => {
    relocateAsset.mockResolvedValue({ relocation: { id: 1 }, unit: { id: 5 } });
    const { POST } = await import('../assets/[id]/relocate');

    const body = { to_location_id: 'loc-b', row_version: 3, notes: 'n', source: 'ops', moved_by_admin_id: 'evil' };
    const response = await POST({ request: request('/api/inventory/assets/5/relocate', 'POST', body), params: { id: '5' }, ...operator } as never);

    expect(response.status).toBe(200);
    expect(relocateAsset).toHaveBeenCalledWith({
      assetId: 5,
      toLocationId: 'loc-b',
      movedByUserId: 'op-uuid',
      source: 'dashboard',
      expectedRowVersion: 3,
      notes: 'n',
    });
    expect(await response.json()).toEqual({ success: true, data: { relocation: { id: 1 }, unit: { id: 5 } } });
  });

  it('answers 409 when another move won', async () => {
    relocateAsset.mockRejectedValue(new InventoryError(UNIT_ERRORS.CONFLICT, 409));
    const { POST } = await import('../assets/[id]/relocate');

    const response = await POST({ request: request('/api/inventory/assets/5/relocate', 'POST', { to_location_id: 'b', row_version: 1 }), params: { id: '5' }, ...admin } as never);
    expect(response.status).toBe(409);
  });
});

describe('GET /api/inventory/counts', () => {
  it('parses product_ids and returns the counts', async () => {
    getByProductIds.mockResolvedValue([{ product_id: 1, total: 2 }]);
    const { GET } = await import('../counts');

    const response = await GET({ request: request('/api/inventory/counts?product_ids=1,%202,1'), ...admin } as never);

    expect(response.status).toBe(200);
    expect(getByProductIds).toHaveBeenCalledWith([1, 2, 1]);
    expect(await response.json()).toEqual({ success: true, data: { counts: [{ product_id: 1, total: 2 }] } });
  });

  it('requires product_ids and rejects garbage', async () => {
    const { GET } = await import('../counts');
    expect((await GET({ request: request('/api/inventory/counts'), ...admin } as never)).status).toBe(400);
    expect((await GET({ request: request('/api/inventory/counts?product_ids=1,x'), ...admin } as never)).status).toBe(400);
    expect(getByProductIds).not.toHaveBeenCalled();
  });
});
