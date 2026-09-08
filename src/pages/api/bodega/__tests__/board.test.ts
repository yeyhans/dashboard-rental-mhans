import { afterEach, describe, expect, it, vi } from 'vitest';

const getBoard = vi.fn();

vi.mock('../../../../middleware/auth', () => ({
  withAuth: (handler: (context: any) => Promise<Response>) => async (context: any) => {
    if (!context.locals?.user) {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 });
    }
    return handler(context);
  },
}));

vi.mock('../../../../services/bodegaService', () => ({
  BodegaService: { getBoard },
}));

const operator = { locals: { user: { id: 'op', email: 'bodega@x.cl', role: 'operator' } } };
const request = new Request('https://dashboard.mariohans.cl/api/bodega/board');

describe('GET /api/bodega/board', () => {
  afterEach(() => vi.clearAllMocks());

  it('requires authentication', async () => {
    const { GET } = await import('../board');
    const response = await GET({ request, locals: {} } as never);
    expect(response.status).toBe(401);
    expect(getBoard).not.toHaveBeenCalled();
  });

  it('returns the board, uncached', async () => {
    getBoard.mockResolvedValue({ pickups: [], returns: [] });
    const { GET } = await import('../board');
    const response = await GET({ request, ...operator } as never);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ success: true, data: { pickups: [], returns: [] } });
  });

  it('500 with a Spanish message on failure', async () => {
    getBoard.mockRejectedValue(new Error('db'));
    const { GET } = await import('../board');
    const response = await GET({ request, ...operator } as never);
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe('No se pudo cargar el tablero de bodega');
  });
});
