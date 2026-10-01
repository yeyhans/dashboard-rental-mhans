import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * T-014a. This service used to build its own `createClient(url, anonKey)` at module scope and
 * talk to PostgREST from the browser. The dashboard admin session lives in HTTP-only cookies that
 * such a client never reads, so every request was anonymous even for a logged-in super_admin.
 * It is now a thin fetch client over the admin-gated `/api/communications/**` routes.
 */
const createClient = vi.fn(() => {
  throw new Error('communicationsService must not build a Supabase client in the browser');
});

vi.mock('@supabase/supabase-js', () => ({ createClient }));

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  );
}

const sampleMessage = {
  id: 7,
  order_id: 42,
  user_id: 'admin-1',
  user_type: 'admin',
  message: 'Equipo listo',
  message_type: 'text',
  file_url: null,
  file_name: null,
  is_read: false,
  user_name: 'Mario',
  user_email: 'admin@x.cl',
  created_at: '2026-08-18T10:00:00.000Z',
  updated_at: '2026-08-18T10:00:00.000Z',
};

describe('communicationsService (browser HTTP client)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('never constructs a Supabase client', async () => {
    await import('../communicationsService');

    expect(createClient).not.toHaveBeenCalled();
  });

  it('reads the thread through the authenticated route', async () => {
    fetchMock.mockReturnValue(jsonResponse({ success: true, data: { messages: [sampleMessage], total: 1 } }));
    const { communicationsService } = await import('../communicationsService');

    const messages = await communicationsService.getOrderCommunications(42);

    expect(messages).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/communications/order/42', expect.anything());
  });

  it('sends a message as a POST to the order thread route', async () => {
    fetchMock.mockReturnValue(jsonResponse({ success: true, data: sampleMessage }, 201));
    const { communicationsService } = await import('../communicationsService');

    await communicationsService.sendMessage(42, 'admin-1', 'admin', 'Equipo listo', 'Mario', 'admin@x.cl');

    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; body: string }];
    expect(url).toBe('/api/communications/order/42');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      userId: 'admin-1',
      userType: 'admin',
      message: 'Equipo listo',
      messageType: 'text',
      fileUrl: undefined,
      fileName: undefined,
      userName: 'Mario',
      userEmail: 'admin@x.cl',
    });
  });

  it('marks the thread as read through the mark-read route', async () => {
    fetchMock.mockReturnValue(jsonResponse({ success: true, data: { updated: 3 } }));
    const { communicationsService } = await import('../communicationsService');

    await communicationsService.markMessagesAsRead(42, 'admin-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; body: string }];
    expect(url).toBe('/api/communications/order/42/mark-read');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ userId: 'admin-1' });
  });

  it('requests basic stats scoped to the user', async () => {
    fetchMock.mockReturnValue(
      jsonResponse({ success: true, data: { total_messages: 3, unread_messages: 1, last_message_at: null } })
    );
    const { communicationsService } = await import('../communicationsService');

    const stats = await communicationsService.getCommunicationStats(42, 'admin-1');

    expect(stats.unread_messages).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/communications/order/42/stats?userId=admin-1', expect.anything());
  });

  it('requests advanced stats from the same route with the advanced flag', async () => {
    const advanced = {
      total_messages: 3,
      customer_messages: 1,
      admin_messages: 2,
      unread_messages: 0,
      messages_with_files: 0,
      last_message_at: null,
      first_message_at: null,
      average_response_time_hours: null,
    };
    fetchMock.mockReturnValue(jsonResponse({ success: true, data: { ...advanced, advanced } }));
    const { communicationsService } = await import('../communicationsService');

    const stats = await communicationsService.getAdvancedCommunicationStats(42);

    expect(stats.admin_messages).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith('/api/communications/order/42/stats?advanced=true', expect.anything());
  });

  it('surfaces the Spanish server error message instead of a generic failure', async () => {
    fetchMock.mockReturnValue(jsonResponse({ success: false, error: 'ID de orden inválido' }, 400));
    const { communicationsService } = await import('../communicationsService');

    await expect(communicationsService.getOrderCommunications(42)).rejects.toThrow('ID de orden inválido');
  });

  it('exports a conversation by combining the thread and the advanced stats routes', async () => {
    fetchMock
      .mockReturnValueOnce(jsonResponse({ success: true, data: { messages: [sampleMessage], total: 1 } }))
      .mockReturnValueOnce(
        jsonResponse({
          success: true,
          data: {
            advanced: {
              total_messages: 1,
              customer_messages: 0,
              admin_messages: 1,
              unread_messages: 1,
              messages_with_files: 0,
              last_message_at: sampleMessage.created_at,
              first_message_at: sampleMessage.created_at,
              average_response_time_hours: null,
            },
          },
        })
      );
    const { communicationsService } = await import('../communicationsService');

    const exported = await communicationsService.exportConversation(42);

    expect(exported.order_id).toBe(42);
    expect(exported.messages).toHaveLength(1);
    expect(exported.stats.admin_messages).toBe(1);
  });
});
