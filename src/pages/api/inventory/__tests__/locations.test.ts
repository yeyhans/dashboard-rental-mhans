import { afterEach, describe, expect, it, vi } from 'vitest';

import { InventoryError } from '../../../../lib/inventoryUnits';
import { LOCATION_ERRORS } from '../../../../lib/warehouseLocations';

/**
 * Warehouse location endpoints (0021). Validation and persistence are covered by
 * `warehouseLocationService.test.ts`; this suite checks auth, params, the acting admin taken from
 * the session, and the InventoryError -> status mapping.
 */
const list = vi.fn();
const tree = vi.fn();
const create = vi.fn();
const update = vi.fn();
const deactivate = vi.fn();

vi.mock('../../../../middleware/auth', () => ({
  withAuth: (handler: (context: any) => Promise<Response>) => async (context: any) => {
    if (!context.locals?.user) {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 });
    }
    return handler(context);
  },
}));

vi.mock('../../../../services/warehouseLocationService', () => ({
  WarehouseLocationService: { list, tree, create, update, deactivate },
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

describe('GET /api/inventory/locations', () => {
  it('requires authentication', async () => {
    const { GET } = await import('../locations/index');
    const response = await GET({ request: request('/api/inventory/locations'), locals: {} } as never);
    expect(response.status).toBe(401);
  });

  it('lists active locations by default and all of them on include_inactive=1', async () => {
    list.mockResolvedValue([{ id: 'a' }]);
    const { GET } = await import('../locations/index');

    const response = await GET({ request: request('/api/inventory/locations'), ...admin } as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: { locations: [{ id: 'a' }], total: 1 } });
    expect(list).toHaveBeenCalledWith({ includeInactive: false });

    await GET({ request: request('/api/inventory/locations?include_inactive=1'), ...admin } as never);
    expect(list).toHaveBeenLastCalledWith({ includeInactive: true });
  });

  it('returns the nested tree on view=tree', async () => {
    tree.mockResolvedValue([{ id: 'root', children: [] }]);
    const { GET } = await import('../locations/index');

    const response = await GET({ request: request('/api/inventory/locations?view=tree'), ...admin } as never);
    expect(await response.json()).toEqual({ success: true, data: { tree: [{ id: 'root', children: [] }] } });
  });

  it('hides internal errors behind a generic 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    list.mockRejectedValue(new Error('relation "warehouse_locations" does not exist'));
    const { GET } = await import('../locations/index');

    const response = await GET({ request: request('/api/inventory/locations'), ...admin } as never);
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe('Error al consultar las ubicaciones');
  });
});

describe('POST /api/inventory/locations', () => {
  it('creates with the acting admin uuid from the session, never from the body', async () => {
    create.mockResolvedValue({ location: { id: 'n' }, warnings: [] });
    const { POST } = await import('../locations/index');

    const response = await POST({ request: request('/api/inventory/locations', 'POST', { code: 'N-E2', updated_by: 'evil' }), ...admin } as never);

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith({ code: 'N-E2', updated_by: 'evil' }, 'auth-uuid');
    expect(await response.json()).toEqual({ success: true, data: { location: { id: 'n' }, warnings: [] } });
  });

  it('maps an InventoryError to its status and code', async () => {
    create.mockRejectedValue(new InventoryError(LOCATION_ERRORS.CODE_TAKEN, 409));
    const { POST } = await import('../locations/index');

    const response = await POST({ request: request('/api/inventory/locations', 'POST', { code: 'N-E1' }), ...admin } as never);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ success: false, error: LOCATION_ERRORS.CODE_TAKEN, code: 'CONFLICT' });
  });

  it('rejects malformed JSON', async () => {
    const { POST } = await import('../locations/index');
    const response = await POST({ request: request('/api/inventory/locations', 'POST', '{nope'), ...admin } as never);
    expect(response.status).toBe(400);
  });
});

describe('PUT /api/inventory/locations/[id]', () => {
  it('passes the patch without row_version, the expected version and the actor', async () => {
    update.mockResolvedValue({ location: { id: 'loc', row_version: 3 }, warnings: ['x'] });
    const { PUT } = await import('../locations/[id]');

    const response = await PUT({
      request: request('/api/inventory/locations/loc', 'PUT', { name: 'Nuevo', row_version: 2 }),
      params: { id: 'loc' },
      ...admin,
    } as never);

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith('loc', { name: 'Nuevo' }, 2, 'auth-uuid');
    expect((await response.json()).data.warnings).toEqual(['x']);
  });

  it('answers 409 with code CONFLICT on a stale version', async () => {
    update.mockRejectedValue(new InventoryError(LOCATION_ERRORS.CONFLICT, 409));
    const { PUT } = await import('../locations/[id]');

    const response = await PUT({ request: request('/api/inventory/locations/loc', 'PUT', { name: 'x', row_version: 1 }), params: { id: 'loc' }, ...admin } as never);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('CONFLICT');
  });

  it('rejects a malformed id', async () => {
    const { PUT } = await import('../locations/[id]');
    const response = await PUT({ request: request('/api/inventory/locations/x', 'PUT', { row_version: 1 }), params: { id: ' ' }, ...admin } as never);
    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/inventory/locations/[id]', () => {
  it('deactivates (soft) with the version from the query string', async () => {
    deactivate.mockResolvedValue({ id: 'loc', is_active: false });
    const { DELETE } = await import('../locations/[id]');

    const response = await DELETE({ request: request('/api/inventory/locations/loc?row_version=4', 'DELETE'), params: { id: 'loc' }, ...admin } as never);

    expect(response.status).toBe(200);
    expect(deactivate).toHaveBeenCalledWith('loc', 4, 'auth-uuid');
    expect(await response.json()).toEqual({ success: true, data: { location: { id: 'loc', is_active: false } } });
  });

  it('answers 409 when units are stored there', async () => {
    deactivate.mockRejectedValue(new InventoryError(`${LOCATION_ERRORS.HAS_UNITS} (2)`, 409));
    const { DELETE } = await import('../locations/[id]');

    const response = await DELETE({ request: request('/api/inventory/locations/loc?row_version=1', 'DELETE'), params: { id: 'loc' }, ...admin } as never);
    expect(response.status).toBe(409);
  });
});
