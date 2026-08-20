import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../lib/supabase', () => ({
  getServerAdmin: vi.fn(async () => null),
}));

/**
 * El endpoint arrastra `@react-pdf/renderer` entero por su import de `pdfService`. Este test
 * comprueba la autorización y devuelve 401 antes de renderizar nada, así que esa carga es puro
 * peso: bajo `--file-parallelism` su transform excedía el límite de la fase de recolección y la
 * suite fallaba de forma intermitente con `STACK_TRACE_ERROR` en la línea del `it`, sin relación
 * con la aserción. En serie siempre pasaba, que es la firma de una contención, no de un bug.
 */
vi.mock('../../../../lib/pdf/core/pdfService', () => ({
  generatePdfBuffer: vi.fn(async () => Buffer.from('')),
}));

describe('contract PDF generation authorization', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects generic Supabase bearer tokens before reading JSON', async () => {
    const json = vi.fn(async () => ({ userData: { user_id: 1, email: 'cliente@example.com' } }));
    const { POST } = await import('../generate-pdf');
    const request = new Request('https://dashboard.mariohans.cl/api/contracts/generate-pdf', {
      method: 'POST',
      headers: { Authorization: 'Bearer customer-token' },
      body: '{}',
    });
    Object.defineProperty(request, 'json', { value: json });

    const response = await POST({ request } as never);

    expect(response.status).toBe(401);
    expect(json).not.toHaveBeenCalled();
  });
});
