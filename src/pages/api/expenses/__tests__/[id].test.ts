import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * `PUT`/`DELETE /api/expenses/[id]` (T-026 gap 3). Review R3 on `4de3c5c`:
 *   - R3-101 (CRITICAL): DELETE must answer 404 for a nonexistent id, not 200.
 *   - R3-105 (WARNING): PUT must validate related_order_id/related_asset_id like POST
 *     (Number.isInteger && > 0), not just a null-check.
 *   - R3-106 (SUGGESTION): PUT must reject an unparseable expense_date with a specific 400.
 */
const update = vi.fn();
const del = vi.fn();

vi.mock('../../../../middleware/auth', () => ({
  withAuth: (handler: (context: any) => Promise<Response>) => async (context: any) => {
    if (!context.locals?.user) {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 });
    }
    return handler(context);
  },
}));

vi.mock('../../../../services/expenseService', () => ({
  ExpenseService: { update, delete: del },
}));

const admin = { locals: { user: { id: 'admin-1', email: 'admin@x.cl', role: 'admin' } } };

function putRequest(id: string, body: unknown) {
  return new Request(`https://dashboard.mariohans.cl/api/expenses/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('DELETE /api/expenses/[id]', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    const { DELETE } = await import('../[id]');
    const response = await DELETE({ params: { id: '1' }, locals: {} } as never);

    expect(response.status).toBe(401);
    expect(del).not.toHaveBeenCalled();
  });

  it('answers 200 when the expense existed and was deleted', async () => {
    del.mockResolvedValue(true);
    const { DELETE } = await import('../[id]');

    const response = await DELETE({ params: { id: '1' }, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
  });

  // R3-101: the endpoint must not translate "nothing was deleted" into a 200.
  it('answers 404 for a nonexistent id instead of reporting success', async () => {
    del.mockResolvedValue(false);
    const { DELETE } = await import('../[id]');

    const response = await DELETE({ params: { id: '999' }, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Gasto no encontrado');
  });

  it('rejects a non-numeric id with 400 before calling the service', async () => {
    const { DELETE } = await import('../[id]');

    const response = await DELETE({ params: { id: 'abc' }, ...admin } as never);

    expect(response.status).toBe(400);
    expect(del).not.toHaveBeenCalled();
  });
});

describe('PUT /api/expenses/[id]', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('updates a valid field', async () => {
    update.mockResolvedValue({ id: 1, amount: 5000 });
    const request = putRequest('1', { amount: 5000 });
    const { PUT } = await import('../[id]');

    const response = await PUT({ request, params: { id: '1' }, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.amount).toBe(5000);
  });

  it('answers 404 when the service reports the expense does not exist', async () => {
    update.mockRejectedValue(new Error('Gasto no encontrado'));
    const request = putRequest('999', { amount: 5000 });
    const { PUT } = await import('../[id]');

    const response = await PUT({ request, params: { id: '999' }, ...admin } as never);

    expect(response.status).toBe(404);
  });

  // R3-105: PUT must validate related_order_id the same way POST does — Number.isInteger && > 0,
  // not just a null-check that lets non-numeric or non-positive values silently through.
  it('rejects a non-integer related_order_id with a specific 400 (parity with POST)', async () => {
    const request = putRequest('1', { related_order_id: 'not-a-number' });
    const { PUT } = await import('../[id]');

    const response = await PUT({ request, params: { id: '1' }, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('orden relacionada');
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects a zero or negative related_order_id with a specific 400', async () => {
    const request = putRequest('1', { related_order_id: 0 });
    const { PUT } = await import('../[id]');

    const response = await PUT({ request, params: { id: '1' }, ...admin } as never);

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects a non-integer related_asset_id with a specific 400 (parity with POST)', async () => {
    const request = putRequest('1', { related_asset_id: 1.5 });
    const { PUT } = await import('../[id]');

    const response = await PUT({ request, params: { id: '1' }, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('equipo relacionado');
    expect(update).not.toHaveBeenCalled();
  });

  it('accepts an explicit null to clear related_order_id', async () => {
    update.mockResolvedValue({ id: 1, related_order_id: null });
    const request = putRequest('1', { related_order_id: null });
    const { PUT } = await import('../[id]');

    const response = await PUT({ request, params: { id: '1' }, ...admin } as never);

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ related_order_id: null }));
  });

  // R3-106: an unparseable expense_date must not reach the service as an opaque string.
  it('rejects an unparseable expense_date with a specific 400', async () => {
    const request = putRequest('1', { expense_date: 'not-a-date' });
    const { PUT } = await import('../[id]');

    const response = await PUT({ request, params: { id: '1' }, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('fecha');
    expect(update).not.toHaveBeenCalled();
  });

  it('accepts a parseable expense_date', async () => {
    update.mockResolvedValue({ id: 1, expense_date: '2026-08-01' });
    const request = putRequest('1', { expense_date: '2026-08-01' });
    const { PUT } = await import('../[id]');

    const response = await PUT({ request, params: { id: '1' }, ...admin } as never);

    expect(response.status).toBe(200);
  });
});
