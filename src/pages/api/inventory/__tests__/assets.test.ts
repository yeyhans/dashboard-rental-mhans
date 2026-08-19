import { afterEach, describe, expect, it, vi } from 'vitest';

const createAsset = vi.fn();
const getAssetBySerial = vi.fn();
const listAssetsByProduct = vi.fn();

vi.mock('../../../../middleware/auth', () => ({
  withAuth: (handler: (context: any) => Promise<Response>) => async (context: any) => {
    if (!context.locals?.user) {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 });
    }
    return handler(context);
  },
}));

vi.mock('../../../../services/serialisedAssetService', () => ({
  SerialisedAssetService: { createAsset, getAssetBySerial, listAssetsByProduct },
}));

const admin = { locals: { user: { id: 'admin-1', email: 'admin@x.cl', role: 'admin' } } };

function postRequest(body: unknown) {
  return new Request('https://dashboard.mariohans.cl/api/inventory/assets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/inventory/assets', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('refuses an unauthenticated intake before parsing the body or writing', async () => {
    const request = postRequest({ product_id: 42, serial_number: 'S-1' });
    const json = vi.fn(async () => ({}));
    Object.defineProperty(request, 'json', { value: json });
    const { POST } = await import('../assets');

    const response = await POST({ request, locals: {} } as never);

    expect(response.status).toBe(401);
    expect(json).not.toHaveBeenCalled();
    expect(createAsset).not.toHaveBeenCalled();
  });

  it('creates an asset for an authenticated admin and answers 201 with the envelope', async () => {
    createAsset.mockResolvedValue({ id: 7, product_id: 42, serial_number: 'PROFOTO-B10-0007' });
    const request = postRequest({
      product_id: 42,
      serial_number: 'PROFOTO-B10-0007',
      condition: 'operational',
      location: 'Bodega Purísima',
      kit_code: 'KIT-LUZ-01',
    });
    const { POST } = await import('../assets');

    const response = await POST({ request, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toEqual({ success: true, data: { id: 7, product_id: 42, serial_number: 'PROFOTO-B10-0007' } });
    expect(createAsset).toHaveBeenCalledWith({
      product_id: 42,
      serial_number: 'PROFOTO-B10-0007',
      condition: 'operational',
      location: 'Bodega Purísima',
      kit_code: 'KIT-LUZ-01',
      notes: null,
    });
  });

  it('treats an omitted kit as absent membership rather than an empty kit code', async () => {
    createAsset.mockResolvedValue({ id: 8 });
    const request = postRequest({
      product_id: 42,
      serial_number: 'S-2',
      condition: 'operational',
      location: 'Bodega',
      kit_code: '   ',
    });
    const { POST } = await import('../assets');

    await POST({ request, ...admin } as never);

    expect(createAsset).toHaveBeenCalledWith(expect.objectContaining({ kit_code: null }));
  });

  it('rejects a missing serial number with a Spanish 400 and no service call', async () => {
    const request = postRequest({ product_id: 42, condition: 'operational', location: 'Bodega' });
    const { POST } = await import('../assets');

    const response = await POST({ request, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain('serie');
    expect(createAsset).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric product_id', async () => {
    const request = postRequest({
      product_id: 'profoto',
      serial_number: 'S-3',
      condition: 'operational',
      location: 'Bodega',
    });
    const { POST } = await import('../assets');

    const response = await POST({ request, ...admin } as never);

    expect(response.status).toBe(400);
    expect(createAsset).not.toHaveBeenCalled();
  });

  it('answers 409 when the serial is already registered', async () => {
    createAsset.mockRejectedValue(new Error('Ya existe un equipo registrado con ese número de serie'));
    const request = postRequest({
      product_id: 42,
      serial_number: 'PROFOTO-B10-0007',
      condition: 'operational',
      location: 'Bodega',
    });
    const { POST } = await import('../assets');

    const response = await POST({ request, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toBe('Ya existe un equipo registrado con ese número de serie');
  });

  it('hides internal failures behind a generic Spanish 500', async () => {
    createAsset.mockRejectedValue(new Error('connection terminated unexpectedly'));
    const request = postRequest({
      product_id: 42,
      serial_number: 'S-4',
      condition: 'operational',
      location: 'Bodega',
    });
    const { POST } = await import('../assets');

    const response = await POST({ request, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).not.toContain('connection terminated');
  });
});

describe('GET /api/inventory/assets', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    const request = new Request('https://dashboard.mariohans.cl/api/inventory/assets?product_id=42');
    const { GET } = await import('../assets');

    const response = await GET({ request, locals: {} } as never);

    expect(response.status).toBe(401);
    expect(listAssetsByProduct).not.toHaveBeenCalled();
  });

  it('looks an asset up by serial number when the serial query param is present', async () => {
    getAssetBySerial.mockResolvedValue({ id: 7, serial_number: 'PROFOTO-B10-0007' });
    const request = new Request(
      'https://dashboard.mariohans.cl/api/inventory/assets?serial=PROFOTO-B10-0007'
    );
    const { GET } = await import('../assets');

    const response = await GET({ request, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.id).toBe(7);
    expect(getAssetBySerial).toHaveBeenCalledWith('PROFOTO-B10-0007');
  });

  it('answers 404 for an unregistered serial', async () => {
    getAssetBySerial.mockResolvedValue(null);
    const request = new Request('https://dashboard.mariohans.cl/api/inventory/assets?serial=NO-EXISTE');
    const { GET } = await import('../assets');

    const response = await GET({ request, ...admin } as never);

    expect(response.status).toBe(404);
  });

  it('lists the assets of a product when product_id is given', async () => {
    listAssetsByProduct.mockResolvedValue([{ id: 7 }, { id: 8 }]);
    const request = new Request('https://dashboard.mariohans.cl/api/inventory/assets?product_id=42');
    const { GET } = await import('../assets');

    const response = await GET({ request, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.assets).toHaveLength(2);
    expect(listAssetsByProduct).toHaveBeenCalledWith(42);
  });

  it('rejects a request that names neither a serial nor a product', async () => {
    const request = new Request('https://dashboard.mariohans.cl/api/inventory/assets');
    const { GET } = await import('../assets');

    const response = await GET({ request, ...admin } as never);

    expect(response.status).toBe(400);
  });
});
