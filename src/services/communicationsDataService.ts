import { supabaseAdmin } from '../lib/supabase';
import type {
  AdvancedCommunicationStats,
  CommunicationStats,
  CreateCommunicationInput,
  OrderCommunication,
} from '../types/communications';

export interface ListByOrderOptions {
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListByOrderResult {
  messages: OrderCommunication[];
  total: number;
}

/**
 * Server-only data layer for `order_communications`, on the service-role client.
 *
 * Never import this from a React component or any module a browser bundle can reach: it pulls in
 * the service-role Supabase client. The browser talks to `/api/communications/**` instead, via
 * `services/communicationsService.ts`.
 */
export class CommunicationsDataService {
  private static client() {
    if (!supabaseAdmin) {
      throw new Error('supabaseAdmin no está inicializado');
    }
    return supabaseAdmin as any;
  }

  static async listByOrder(orderId: number, options: ListByOrderOptions = {}): Promise<ListByOrderResult> {
    const { search, page, limit } = options;

    let query = this.client()
      .from('order_communications')
      .select('*', { count: 'exact' })
      .eq('order_id', orderId);

    if (search) {
      query = query.ilike('message', `%${search}%`);
    }

    query = query.order('created_at', { ascending: true });

    if (page && limit) {
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return { messages: (data as OrderCommunication[]) || [], total: count ?? (data?.length || 0) };
  }

  static async create(input: CreateCommunicationInput): Promise<OrderCommunication> {
    const { data, error } = await this.client()
      .from('order_communications')
      .insert({
        order_id: input.orderId,
        user_id: input.userId,
        user_type: input.userType,
        message: input.message,
        message_type: input.messageType || 'text',
        file_url: input.fileUrl ?? null,
        file_name: input.fileName ?? null,
        is_read: false,
        user_name: input.userName ?? null,
        user_email: input.userEmail ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as OrderCommunication;
  }

  /** Marks every unread message written by someone other than `userId`. Returns the row count. */
  static async markThreadAsRead(orderId: number, userId: string): Promise<number> {
    const { data, error } = await this.client()
      .from('order_communications')
      .update({ is_read: true })
      .eq('order_id', orderId)
      .neq('user_id', userId)
      .eq('is_read', false)
      .select('id');

    if (error) throw error;
    return data?.length || 0;
  }

  static async deleteById(messageId: number): Promise<void> {
    const { error } = await this.client().from('order_communications').delete().eq('id', messageId);
    if (error) throw error;
  }

  /**
   * One SELECT feeds both stat shapes. The previous browser implementation issued three separate
   * count queries for the basic block alone.
   */
  private static async loadThread(orderId: number): Promise<OrderCommunication[]> {
    const { data, error } = await this.client()
      .from('order_communications')
      .select('id, user_id, user_type, is_read, file_url, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data as OrderCommunication[]) || [];
  }

  static async getStats(orderId: number, userId?: string): Promise<CommunicationStats> {
    const messages = await this.loadThread(orderId);

    return {
      total_messages: messages.length,
      unread_messages: userId
        ? messages.filter((m) => !m.is_read && m.user_id !== userId).length
        : 0,
      last_message_at: messages.at(-1)?.created_at || null,
    };
  }

  static async getAdvancedStats(orderId: number): Promise<AdvancedCommunicationStats> {
    const messages = await this.loadThread(orderId);

    if (messages.length === 0) {
      return {
        total_messages: 0,
        customer_messages: 0,
        admin_messages: 0,
        unread_messages: 0,
        messages_with_files: 0,
        last_message_at: null,
        first_message_at: null,
        average_response_time_hours: null,
      };
    }

    let totalResponseTime = 0;
    let responseCount = 0;

    for (let i = 1; i < messages.length; i++) {
      const current = messages[i]!;
      const previous = messages[i - 1]!;

      // Un cambio de interlocutor marca una respuesta; los mensajes seguidos del mismo lado no.
      if (current.user_type !== previous.user_type) {
        totalResponseTime += new Date(current.created_at).getTime() - new Date(previous.created_at).getTime();
        responseCount++;
      }
    }

    return {
      total_messages: messages.length,
      customer_messages: messages.filter((m) => m.user_type === 'customer').length,
      admin_messages: messages.filter((m) => m.user_type === 'admin').length,
      unread_messages: messages.filter((m) => !m.is_read).length,
      messages_with_files: messages.filter((m) => m.file_url).length,
      last_message_at: messages.at(-1)?.created_at || null,
      first_message_at: messages[0]?.created_at || null,
      average_response_time_hours:
        responseCount > 0 ? totalResponseTime / responseCount / (1000 * 60 * 60) : null,
    };
  }
}
