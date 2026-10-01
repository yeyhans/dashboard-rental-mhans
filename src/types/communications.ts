/**
 * Shared shapes for the order-communications feature.
 *
 * These live outside `services/` on purpose: the browser client
 * (`services/communicationsService.ts`) and the server data layer
 * (`services/communicationsDataService.ts`) both need them, and the browser must never
 * transitively import the module that builds the service-role Supabase client.
 */

export type CommunicationUserType = 'customer' | 'admin';
export type CommunicationMessageType = 'text' | 'image' | 'file';

export interface OrderCommunication {
  id: number;
  order_id: number;
  user_id: string;
  user_type: CommunicationUserType;
  message: string;
  message_type: CommunicationMessageType;
  file_url?: string | null;
  file_name?: string | null;
  is_read: boolean;
  user_name?: string | null;
  user_email?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunicationStats {
  total_messages: number;
  unread_messages: number;
  last_message_at: string | null;
}

export interface AdvancedCommunicationStats {
  total_messages: number;
  customer_messages: number;
  admin_messages: number;
  unread_messages: number;
  messages_with_files: number;
  last_message_at: string | null;
  first_message_at: string | null;
  average_response_time_hours: number | null;
}

export interface PaginatedMessages {
  messages: OrderCommunication[];
  total: number;
  hasMore: boolean;
  page: number;
  limit: number;
}

export interface ConversationExport {
  order_id: number;
  exported_at: string;
  messages: OrderCommunication[];
  stats: AdvancedCommunicationStats;
}

export interface CreateCommunicationInput {
  orderId: number;
  userId: string;
  userType: CommunicationUserType;
  message: string;
  messageType?: CommunicationMessageType;
  fileUrl?: string;
  fileName?: string;
  userName?: string;
  userEmail?: string;
}
