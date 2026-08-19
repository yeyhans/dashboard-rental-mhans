import type {
  AdvancedCommunicationStats,
  CommunicationMessageType,
  CommunicationStats,
  CommunicationUserType,
  ConversationExport,
  OrderCommunication,
  PaginatedMessages,
} from '../types/communications';

export type {
  AdvancedCommunicationStats,
  CommunicationStats,
  ConversationExport,
  OrderCommunication,
  PaginatedMessages,
} from '../types/communications';

export interface OrderWithCommunications {
  order_id: number;
  stats: CommunicationStats;
  advanced_stats?: AdvancedCommunicationStats;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Browser client for the order-communications feature.
 *
 * It deliberately holds no Supabase client. The admin session lives in HTTP-only cookies that a
 * browser-side `createClient(url, anonKey)` cannot read, so the previous PostgREST calls were
 * anonymous even for a logged-in super_admin — and after migration 0001 (RLS on
 * `order_communications`, `allow_all_for_testing` dropped) they would silently return nothing.
 * Everything now goes through `/api/communications/**`, which is admin-gated and service-role
 * backed. Same-origin fetch sends the session cookies automatically.
 */
async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || 'Error al comunicarse con el servidor');
  }

  return payload.data as T;
}

class CommunicationsService {
  private pollingIntervals = new Map<number, NodeJS.Timeout>();

  async getOrderCommunications(orderId: number): Promise<OrderCommunication[]> {
    const data = await requestJson<{ messages: OrderCommunication[] }>(
      `/api/communications/order/${orderId}`,
      { method: 'GET' }
    );
    return data.messages;
  }

  async getOrderCommunicationsPaginated(
    orderId: number,
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedMessages> {
    return requestJson<PaginatedMessages>(
      `/api/communications/order/${orderId}?page=${page}&limit=${limit}`,
      { method: 'GET' }
    );
  }

  async searchMessages(orderId: number, searchTerm: string): Promise<OrderCommunication[]> {
    const data = await requestJson<{ messages: OrderCommunication[] }>(
      `/api/communications/order/${orderId}?search=${encodeURIComponent(searchTerm)}`,
      { method: 'GET' }
    );
    return data.messages;
  }

  async sendMessage(
    orderId: number,
    userId: string,
    userType: CommunicationUserType,
    message: string,
    userName?: string,
    userEmail?: string,
    messageType: CommunicationMessageType = 'text',
    fileUrl?: string,
    fileName?: string
  ): Promise<OrderCommunication> {
    return requestJson<OrderCommunication>(`/api/communications/order/${orderId}`, {
      method: 'POST',
      body: JSON.stringify({
        userId,
        userType,
        message,
        messageType,
        fileUrl,
        fileName,
        userName,
        userEmail,
      }),
    });
  }

  async sendMessageWithFile(
    orderId: number,
    userId: string,
    userType: CommunicationUserType,
    message: string,
    file: File,
    userName?: string,
    userEmail?: string
  ): Promise<OrderCommunication> {
    // TODO: subir el archivo a R2 (/upload-file-only) y usar la URL real devuelta.
    const fileUrl = `https://example.com/files/${file.name}`;

    return this.sendMessage(
      orderId,
      userId,
      userType,
      message,
      userName,
      userEmail,
      file.type.startsWith('image/') ? 'image' : 'file',
      fileUrl,
      file.name
    );
  }

  async markMessagesAsRead(orderId: number, userId: string): Promise<void> {
    await requestJson<{ updated: number }>(`/api/communications/order/${orderId}/mark-read`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async getCommunicationStats(orderId: number, userId?: string): Promise<CommunicationStats> {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return requestJson<CommunicationStats>(`/api/communications/order/${orderId}/stats${query}`, {
      method: 'GET',
    });
  }

  async getAdvancedCommunicationStats(orderId: number): Promise<AdvancedCommunicationStats> {
    const data = await requestJson<{ advanced: AdvancedCommunicationStats }>(
      `/api/communications/order/${orderId}/stats?advanced=true`,
      { method: 'GET' }
    );
    return data.advanced;
  }

  async deleteMessage(messageId: number, userId: string): Promise<void> {
    await requestJson<unknown>(`/api/communications/${messageId}`, {
      method: 'DELETE',
      body: JSON.stringify({ userId }),
    });
  }

  async exportConversation(orderId: number): Promise<ConversationExport> {
    const messages = await this.getOrderCommunications(orderId);
    const stats = await this.getAdvancedCommunicationStats(orderId);

    return {
      order_id: orderId,
      exported_at: new Date().toISOString(),
      messages,
      stats,
    };
  }

  /**
   * Polls the thread and reports inserts, updates and deletes.
   *
   * There is no Supabase Realtime path any more: a realtime subscription runs on the same anon
   * key with no JWT, so under the 0001 policies it would connect happily and then deliver nothing.
   * Polling an admin-gated route is the only channel that still sees the rows.
   */
  startPollingForOrder(
    orderId: number,
    onMessage: (communication: OrderCommunication) => void,
    onUpdate: (communication: OrderCommunication) => void,
    onDelete: (communicationId: number) => void,
    intervalMs: number = 3000
  ): NodeJS.Timeout {
    this.stopPollingForOrder(orderId);

    let lastMessages: OrderCommunication[] = [];
    let primed = false;

    const pollMessages = async () => {
      try {
        const currentMessages = await this.getOrderCommunications(orderId);

        if (primed) {
          currentMessages.forEach((currentMsg) => {
            const previous = lastMessages.find((m) => m.id === currentMsg.id);
            if (!previous) {
              onMessage(currentMsg);
            } else if (previous.updated_at !== currentMsg.updated_at) {
              onUpdate(currentMsg);
            }
          });

          lastMessages.forEach((lastMsg) => {
            if (!currentMessages.find((m) => m.id === lastMsg.id)) {
              onDelete(lastMsg.id);
            }
          });
        }

        lastMessages = [...currentMessages];
        primed = true;
      } catch (error) {
        console.error('[Communications] Error durante el polling de la orden:', { orderId, error });
      }
    };

    pollMessages();
    const intervalId = setInterval(pollMessages, intervalMs);
    this.pollingIntervals.set(orderId, intervalId);

    return intervalId;
  }

  stopPollingForOrder(orderId: number): void {
    const intervalId = this.pollingIntervals.get(orderId);
    if (intervalId) {
      clearInterval(intervalId);
      this.pollingIntervals.delete(orderId);
    }
  }

  /** Kept as the component-facing teardown name; polling is now the only channel. */
  unsubscribeFromOrder(orderId: number): void {
    this.stopPollingForOrder(orderId);
  }

  unsubscribeAll(): void {
    this.pollingIntervals.forEach((intervalId) => clearInterval(intervalId));
    this.pollingIntervals.clear();
  }
}

export const communicationsService = new CommunicationsService();
