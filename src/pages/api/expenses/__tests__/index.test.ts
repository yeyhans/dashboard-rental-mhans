import { afterEach, describe, expect, it, vi } from 'vitest';

/** `POST /api/expenses` (T-026 gap 3). R3-106: reject an unparseable expense_date with 400. */
const create = vi.fn();
const getAll = vi.fn();

vi.mock('../../../../middleware/auth', () => ({
  withAuth: (handler: (context: any) => Promise<Response>) => async (context: any) => {
    if (!context.locals?.user) {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 });
    }
    return handler(context);
  },
}));

vi.mock('../../../../services/expenseService', () => ({
  ExpenseService: { create, getAll },
}));

const admin = { locals: { user: { id: 'admin-1', email: 'admin@x.cl', role: 'admin' } } };

function postRequest(body: unknown) {
  return new Request('https://dashboard.mariohans.cl/api/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/expenses', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates an expense for a valid body', async () => {
    create.mockResolvedValue({ id: 1, category: 'warehouse', amount: 1000, expense_date: '2026-08-01' });
    const request = postRequest({ category: 'warehouse', amount: 1000, expense_date: '2026-08-01' });
    const { POST } = await import('../index');

    const response = await POST({ request, ...admin } as never);

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalled();
  });

  it('rejects an unparseable expense_date with a specific 400 (R3-106)', async () => {
    const request = postRequest({ category: 'warehouse', amount: 1000, expense_date: 'not-a-date' });
    const { POST } = await import('../index');

    const response = await POST({ request, ...admin } as never);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('fecha');
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a negative amount', async () => {
    const request = postRequest({ category: 'warehouse', amount: -1, expense_date: '2026-08-01' });
    const { POST } = await import('../index');

    const response = await POST({ request, ...admin } as never);

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});
