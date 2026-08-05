import { afterEach, describe, expect, it, vi } from 'vitest';

const generateBudgetPdfFromId = vi.fn();

vi.mock('../../../../../middleware/auth', () => ({
  withAuth: (handler: (context: any) => Promise<Response>) => async (context: any) => {
    if (!context.locals?.user) {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 });
    }

    return handler(context);
  },
}));

vi.mock('../../../../../lib/orderPdfGenerationService', () => ({
  generateBudgetPdfFromId,
}));

describe('order budget generation admin boundary', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated malformed requests before body parsing or service invocation', async () => {
    const json = vi.fn(async () => ({ sendEmail: true }));
    const request = new Request('https://dashboard.mariohans.cl/api/orders/123/generate-budget', {
      method: 'POST',
      body: '{not-json',
    });
    Object.defineProperty(request, 'json', { value: json });
    const { POST } = await import('../generate-budget');

    const response = await POST({ params: { id: '123' }, request, locals: {} } as never);

    expect(response.status).toBe(401);
    expect(json).not.toHaveBeenCalled();
    expect(generateBudgetPdfFromId).not.toHaveBeenCalled();
  });

  it('preserves the authenticated admin generation path and response contract', async () => {
    generateBudgetPdfFromId.mockResolvedValue({
      success: true,
      pdfUrl: 'https://example.com/budget.pdf',
      metadata: { orderId: 123 },
    });
    const request = new Request('https://dashboard.mariohans.cl/api/orders/123/generate-budget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'https://dashboard.mariohans.cl' },
      body: JSON.stringify({ sendEmail: false }),
    });
    const { POST } = await import('../generate-budget');

    const response = await POST({ params: { id: '123' }, request, locals: { user: { id: 'admin-1' } } } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(generateBudgetPdfFromId).toHaveBeenCalledWith(123, true, false);
    expect(body).toEqual({
      success: true,
      message: 'Presupuesto generado exitosamente',
      pdfUrl: 'https://example.com/budget.pdf',
      metadata: { orderId: 123 },
    });
  });
});
