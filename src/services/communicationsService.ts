import { createClient } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Configuración de Supabase para el backend
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'https://supabase-mhans.farmiemos.cl';
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface OrderCommunication {
  id: number;
  order_id: number;
  user_id: string;
  user_type: 'customer' | 'admin';
  message: string;
  message_type: 'text' | 'image' | 'file';
  file_url?: string;
  file_name?: string;
  is_read: boolean;
  user_name?: string;
  user_email?: string;
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

export interface OrderWithCommunications {
  order_id: number;
  stats: CommunicationStats;
  advanced_stats?: AdvancedCommunicationStats;
}

class CommunicationsService {
  private channels: Map<number, RealtimeChannel> = new Map();
  private pollingIntervals = new Map<number, NodeJS.Timeout>();

  /**
   * Obtener todas las comunicaciones de una orden
   */
  async getOrderCommunications(orderId: number): Promise<OrderCommunication[]> {
    try {
      const { data, error } = await supabase
        .from('order_communications')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching communications:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getOrderCommunications:', error);
      throw error;
    }
  }

  /**
   * Enviar un nuevo mensaje
   */
  async sendMessage(
    orderId: number,
    userId: string,
    userType: 'customer' | 'admin',
    message: string,
    userName?: string,
    userEmail?: string,
    messageType: 'text' | 'image' | 'file' = 'text',
    fileUrl?: string,
    fileName?: string
  ): Promise<OrderCommunication> {
    try {
      const { data, error } = await supabase
        .from('order_communications')
        .insert({
          order_id: orderId,
          user_id: userId,
          user_type: userType,
          message,
          message_type: messageType,
          file_url: fileUrl,
          file_name: fileName,
          is_read: false,
          user_name: userName,
          user_email: userEmail
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in sendMessage:', error);
      throw error;
    }
  }

  /**
   * Marcar mensajes como leídos
   */
  async markMessagesAsRead(orderId: number, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('order_communications')
        .update({ is_read: true })
        .eq('order_id', orderId)
        .neq('user_id', userId) // Solo marcar como leídos los mensajes de otros usuarios
        .eq('is_read', false);

      if (error) {
        console.error('Error marking messages as read:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in markMessagesAsRead:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de comunicación para una orden
   */
  async getCommunicationStats(orderId: number, userId?: string): Promise<CommunicationStats> {
    try {
      // Obtener total de mensajes
      const { count: totalMessages, error: totalError } = await supabase
        .from('order_communications')
        .select('*', { count: 'exact', head: true })
        .eq('order_id', orderId);

      if (totalError) {
        console.error('Error getting total messages:', totalError);
        throw totalError;
      }

      // Obtener mensajes no leídos (solo si se proporciona userId)
      let unreadMessages = 0;
      if (userId) {
        const { count: unreadCount, error: unreadError } = await supabase
          .from('order_communications')
          .select('*', { count: 'exact', head: true })
          .eq('order_id', orderId)
          .neq('user_id', userId) // Mensajes de otros usuarios
          .eq('is_read', false);

        if (unreadError) {
          console.error('Error getting unread messages:', unreadError);
        } else {
          unreadMessages = unreadCount || 0;
        }
      }

      // Obtener último mensaje
      const { data: lastMessage, error: lastError } = await supabase
        .from('order_communications')
        .select('created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastError && lastError.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error getting last message:', lastError);
      }

      return {
        total_messages: totalMessages || 0,
        unread_messages: unreadMessages,
        last_message_at: lastMessage?.created_at || null
      };
    } catch (error) {
      console.error('Error in getCommunicationStats:', error);
      throw error;
    }
  }

  /**
   * Suscribirse a cambios en tiempo real para una orden
   */
  subscribeToOrderCommunications(
    orderId: number,
    onMessage: (communication: OrderCommunication) => void,
    onUpdate: (communication: OrderCommunication) => void,
    onDelete: (communicationId: number) => void
  ): RealtimeChannel {
    // Cerrar canal existente si existe
    if (this.channels.has(orderId)) {
      this.unsubscribeFromOrder(orderId);
    }

    const channel = supabase
      .channel(`order_communications_${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_communications',
          filter: `order_id=eq.${orderId}`
        },
        (payload) => {
          console.log('📨 New message received:', payload.new);
          onMessage(payload.new as OrderCommunication);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'order_communications',
          filter: `order_id=eq.${orderId}`
        },
        (payload) => {
          console.log('📝 Message updated:', payload.new);
          onUpdate(payload.new as OrderCommunication);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'order_communications',
          filter: `order_id=eq.${orderId}`
        },
        (payload) => {
          console.log('🗑️ Message deleted:', payload.old);
          onDelete((payload.old as OrderCommunication).id);
        }
      )
      .subscribe((status) => {
        console.log(`📡 Subscription status for order ${orderId}:`, status);
      });

    this.channels.set(orderId, channel);
    return channel;
  }

  /**
   * Configurar polling para una orden (reemplaza Realtime)
   */
  startPollingForOrder(
    orderId: number,
    onMessage: (communication: OrderCommunication) => void,
    onUpdate: (communication: OrderCommunication) => void,
    onDelete: (communicationId: number) => void,
    intervalMs: number = 3000 // 3 segundos por defecto
  ): NodeJS.Timeout {
    console.log(`🔄 Starting admin polling for order ${orderId} (interval: ${intervalMs}ms)`);
    
    let lastMessageCount = 0;
    let lastMessages: OrderCommunication[] = [];

    const pollMessages = async () => {
      try {
        const currentMessages = await this.getOrderCommunications(orderId);
        
        // Detectar nuevos mensajes (comparar por ID, no por cantidad)
        if (lastMessages.length > 0) {
          currentMessages.forEach(currentMsg => {
            const existsInLast = lastMessages.find(m => m.id === currentMsg.id);
            if (!existsInLast) {
              console.log('📨 New message detected via admin polling:', currentMsg.id);
              onMessage(currentMsg);
            }
          });
        } else if (currentMessages.length > 0 && lastMessageCount === 0) {
          // Primera carga - no notificar como nuevos mensajes
          console.log('📋 Initial admin messages loaded:', currentMessages.length);
        }
        
        // Detectar mensajes actualizados
        if (lastMessages.length > 0) {
          currentMessages.forEach(currentMsg => {
            const lastMsg = lastMessages.find(m => m.id === currentMsg.id);
            if (lastMsg && lastMsg.updated_at !== currentMsg.updated_at) {
              console.log('📝 Message updated detected via admin polling:', currentMsg);
              onUpdate(currentMsg);
            }
          });
        }
        
        // Detectar mensajes eliminados
        if (lastMessages.length > 0) {
          lastMessages.forEach(lastMsg => {
            const exists = currentMessages.find(m => m.id === lastMsg.id);
            if (!exists) {
              console.log('🗑️ Message deleted detected via admin polling:', lastMsg.id);
              onDelete(lastMsg.id);
            }
          });
        }
        
        lastMessageCount = currentMessages.length;
        lastMessages = [...currentMessages];
        
      } catch (error) {
        console.error('❌ Error during admin polling:', error);
      }
    };

    // Ejecutar inmediatamente y luego cada intervalo
    pollMessages();
    const intervalId = setInterval(pollMessages, intervalMs);
    
    // Guardar referencia para cleanup
    this.pollingIntervals.set(orderId, intervalId);
    
    console.log(`✅ Admin polling started for order ${orderId}`);
    return intervalId;
  }

  /**
   * Detener polling para una orden específica
   */
  stopPollingForOrder(orderId: number): void {
    const intervalId = this.pollingIntervals.get(orderId);
    if (intervalId) {
      clearInterval(intervalId);
      this.pollingIntervals.delete(orderId);
      console.log(`🛑 Stopped admin polling for order ${orderId}`);
    }
  }

  /**
   * Desuscribirse de una orden específica (Realtime + Polling)
   */
  unsubscribeFromOrder(orderId: number): void {
    // Detener Realtime si existe
    const channel = this.channels.get(orderId);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(orderId);
      console.log(`🔌 Unsubscribed from order ${orderId} communications`);
    }
    
    // Detener polling si existe
    this.stopPollingForOrder(orderId);
  }

  /**
   * Desuscribirse de todas las comunicaciones
   */
  unsubscribeAll(): void {
    // Limpiar todos los canales Realtime
    this.channels.forEach((channel, orderId) => {
      supabase.removeChannel(channel);
      console.log(`🔌 Unsubscribed from order ${orderId} communications`);
    });
    this.channels.clear();
    
    // Limpiar todos los intervalos de polling
    this.pollingIntervals.forEach((intervalId, orderId) => {
      clearInterval(intervalId);
      console.log(`🛑 Stopped admin polling for order ${orderId}`);
    });
    this.pollingIntervals.clear();
  }


  /**
   * Enviar mensaje con archivo adjunto
   */
  async sendMessageWithFile(
    orderId: number,
    userId: string,
    userType: 'customer' | 'admin',
    message: string,
    file: File,
    userName?: string,
    userEmail?: string
  ): Promise<OrderCommunication> {
    try {
      // Aquí se podría implementar la subida del archivo a R2/Storage
      // Por ahora, simulamos que el archivo se sube correctamente
      const fileUrl = `https://example.com/files/${file.name}`;
      
      return await this.sendMessage(
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
    } catch (error) {
      console.error('Error in sendMessageWithFile:', error);
      throw error;
    }
  }

  /**
   * Obtener mensajes con paginación
   */
  async getOrderCommunicationsPaginated(
    orderId: number,
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedMessages> {
    try {
      const offset = (page - 1) * limit;

      // Obtener total de mensajes
      const { count: total, error: countError } = await supabase
        .from('order_communications')
        .select('*', { count: 'exact', head: true })
        .eq('order_id', orderId);

      if (countError) {
        console.error('Error getting message count:', countError);
        throw countError;
      }

      // Obtener mensajes paginados
      const { data, error } = await supabase
        .from('order_communications')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching paginated communications:', error);
        throw error;
      }

      return {
        messages: data || [],
        total: total || 0,
        hasMore: (total || 0) > offset + limit,
        page,
        limit
      };
    } catch (error) {
      console.error('Error in getOrderCommunicationsPaginated:', error);
      throw error;
    }
  }

  /**
   * Buscar mensajes por contenido
   */
  async searchMessages(
    orderId: number,
    searchTerm: string
  ): Promise<OrderCommunication[]> {
    try {
      const { data, error } = await supabase
        .from('order_communications')
        .select('*')
        .eq('order_id', orderId)
        .ilike('message', `%${searchTerm}%`)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error searching messages:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in searchMessages:', error);
      throw error;
    }
  }

  /**
   * Obtener mensajes no leídos para un usuario
   */
  async getUnreadMessages(
    orderId: number,
    userId: string
  ): Promise<OrderCommunication[]> {
    try {
      const { data, error } = await supabase
        .from('order_communications')
        .select('*')
        .eq('order_id', orderId)
        .neq('user_id', userId) // Mensajes de otros usuarios
        .eq('is_read', false)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching unread messages:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUnreadMessages:', error);
      throw error;
    }
  }

  /**
   * Marcar un mensaje específico como leído
   */
  async markMessageAsRead(messageId: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('order_communications')
        .update({ is_read: true })
        .eq('id', messageId);

      if (error) {
        console.error('Error marking message as read:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in markMessageAsRead:', error);
      throw error;
    }
  }

  /**
   * Eliminar un mensaje (solo el autor puede eliminarlo)
   */
  async deleteMessage(messageId: number, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('order_communications')
        .delete()
        .eq('id', messageId)
        .eq('user_id', userId); // Solo el autor puede eliminar

      if (error) {
        console.error('Error deleting message:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in deleteMessage:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas avanzadas de comunicaciones
   */
  async getAdvancedCommunicationStats(orderId: number): Promise<AdvancedCommunicationStats> {
    try {
      // Obtener todos los mensajes de la orden
      const { data: messages, error } = await supabase
        .from('order_communications')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages for stats:', error);
        throw error;
      }

      if (!messages || messages.length === 0) {
        return {
          total_messages: 0,
          customer_messages: 0,
          admin_messages: 0,
          unread_messages: 0,
          messages_with_files: 0,
          last_message_at: null,
          first_message_at: null,
          average_response_time_hours: null
        };
      }

      // Calcular estadísticas
      const customerMessages = messages.filter(m => m.user_type === 'customer').length;
      const adminMessages = messages.filter(m => m.user_type === 'admin').length;
      const unreadMessages = messages.filter(m => !m.is_read).length;
      const messagesWithFiles = messages.filter(m => m.file_url).length;

      // Calcular tiempo promedio de respuesta
      let totalResponseTime = 0;
      let responseCount = 0;

      for (let i = 1; i < messages.length; i++) {
        const currentMsg = messages[i];
        const prevMsg = messages[i - 1];
        
        // Si es una respuesta (diferente tipo de usuario)
        if (currentMsg.user_type !== prevMsg.user_type) {
          const responseTime = new Date(currentMsg.created_at).getTime() - new Date(prevMsg.created_at).getTime();
          totalResponseTime += responseTime;
          responseCount++;
        }
      }

      const averageResponseTimeHours = responseCount > 0 
        ? (totalResponseTime / responseCount) / (1000 * 60 * 60) 
        : null;

      return {
        total_messages: messages.length,
        customer_messages: customerMessages,
        admin_messages: adminMessages,
        unread_messages: unreadMessages,
        messages_with_files: messagesWithFiles,
        last_message_at: messages[messages.length - 1]?.created_at || null,
        first_message_at: messages[0]?.created_at || null,
        average_response_time_hours: averageResponseTimeHours
      };
    } catch (error) {
      console.error('Error in getAdvancedCommunicationStats:', error);
      throw error;
    }
  }

  /**
   * Obtener resumen de actividad reciente
   */
  async getRecentActivity(
    orderId?: number,
    hours: number = 24
  ): Promise<OrderCommunication[]> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - hours);

      let query = supabase
        .from('order_communications')
        .select('*')
        .gte('created_at', cutoffTime.toISOString())
        .order('created_at', { ascending: false });

      if (orderId) {
        query = query.eq('order_id', orderId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching recent activity:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getRecentActivity:', error);
      throw error;
    }
  }

  /**
   * Exportar conversación completa
   */
  async exportConversation(orderId: number): Promise<ConversationExport> {
    try {
      const messages = await this.getOrderCommunications(orderId);
      const stats = await this.getAdvancedCommunicationStats(orderId);

      return {
        order_id: orderId,
        exported_at: new Date().toISOString(),
        messages,
        stats
      };
    } catch (error) {
      console.error('Error in exportConversation:', error);
      throw error;
    }
  }

  /**
   * Obtener todas las órdenes con comunicaciones para el admin
   */
  async getOrdersWithCommunications(): Promise<OrderWithCommunications[]> {
    try {
      const { data, error } = await supabase
        .from('order_communications')
        .select('order_id')
        .order('order_id');

      if (error) {
        console.error('Error fetching orders with communications:', error);
        throw error;
      }

      // Obtener IDs únicos de órdenes
      const uniqueOrderIds = [...new Set(data?.map(item => item.order_id) || [])];

      // Obtener estadísticas para cada orden
      const ordersWithStats = await Promise.all(
        uniqueOrderIds.map(async (orderId) => {
          const stats = await this.getCommunicationStats(orderId);
          const advancedStats = await this.getAdvancedCommunicationStats(orderId);
          return { 
            order_id: orderId, 
            stats,
            advanced_stats: advancedStats
          };
        })
      );

      return ordersWithStats;
    } catch (error) {
      console.error('Error in getOrdersWithCommunications:', error);
      throw error;
    }
  }
}

export const communicationsService = new CommunicationsService();

/**
 * ACTUALIZACIÓN PROFESIONAL - OrderCommunication Interface
 * 
 * Se ha actualizado la interfaz OrderCommunication para que tenga el mismo diseño 
 * profesional que el componente OrderCommunications.tsx del frontend:
 * 
 * ✅ Campos Agregados:
 * - file_url?: string - URL del archivo adjunto
 * - file_name?: string - Nombre del archivo adjunto  
 * - message_type: 'text' | 'image' | 'file' - Tipo de mensaje expandido
 * 
 * ✅ Métodos Profesionales Agregados:
 * - sendMessageWithFile() - Envío de mensajes con archivos
 * - getOrderCommunicationsPaginated() - Paginación de mensajes
 * - searchMessages() - Búsqueda en mensajes
 * - getUnreadMessages() - Mensajes no leídos específicos
 * - markMessageAsRead() - Marcar mensaje individual como leído
 * - getAdvancedCommunicationStats() - Estadísticas avanzadas
 * - getRecentActivity() - Actividad reciente
 * - exportConversation() - Exportar conversación completa
 * 
 * ✅ Interfaces Profesionales:
 * - AdvancedCommunicationStats - Estadísticas detalladas
 * - PaginatedMessages - Mensajes paginados
 * - ConversationExport - Exportación de conversaciones
 * - OrderWithCommunications - Órdenes con comunicaciones
 * 
 * ✅ Características Profesionales:
 * - Soporte completo para archivos adjuntos
 * - Paginación y búsqueda avanzada
 * - Estadísticas detalladas con tiempo de respuesta
 * - Exportación de conversaciones
 * - Actividad reciente y análisis
 * - Tipado TypeScript completo
 * 
 * La interfaz ahora coincide completamente con el diseño profesional
 * del frontend y proporciona todas las funcionalidades avanzadas
 * necesarias para un sistema de comunicaciones empresarial.
 */
