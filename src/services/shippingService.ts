import { supabaseAdmin } from '../lib/supabase';

// Servicio de envíos usando la tabla shipping_methods de Supabase

// Tipos para el sistema de envíos
export interface ShippingMethod {
  id: string;
  name: string;
  description: string | null;
  cost: string; // Decimal stored as string in database
  shipping_type: 'free' | 'flat_rate' | 'local_pickup' | 'calculated' | 'express';
  enabled: boolean;
  min_amount: string | null; // Decimal stored as string
  max_amount: string | null; // Decimal stored as string
  available_regions?: string[] | null;
  excluded_regions?: string[] | null;
  estimated_days_min: string; // Stored as string in database
  estimated_days_max: string; // Stored as string in database
  requires_address: boolean;
  requires_phone: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ShippingMethodInsert {
  id?: string;
  name: string;
  description?: string | null;
  cost: string; // Decimal as string
  shipping_type: 'free' | 'flat_rate' | 'local_pickup' | 'calculated' | 'express';
  enabled?: boolean;
  min_amount?: string | null; // Decimal as string
  max_amount?: string | null; // Decimal as string
  available_regions?: string[] | null;
  excluded_regions?: string[] | null;
  estimated_days_min: string; // String in database
  estimated_days_max: string; // String in database
  requires_address?: boolean;
  requires_phone?: boolean;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
}

export interface ShippingMethodUpdate {
  id?: string;
  name?: string;
  description?: string | null;
  cost?: string; // Decimal as string
  shipping_type?: 'free' | 'flat_rate' | 'local_pickup' | 'calculated' | 'express';
  enabled?: boolean;
  min_amount?: string | null; // Decimal as string
  max_amount?: string | null; // Decimal as string
  available_regions?: string[] | null;
  excluded_regions?: string[] | null;
  estimated_days_min?: string; // String in database
  estimated_days_max?: string; // String in database
  requires_address?: boolean;
  requires_phone?: boolean;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
}

export interface ShippingUsage {
  id: number;
  shipping_method_id: number;
  order_id: number;
  user_id: number | null;
  shipping_cost: number;
  shipping_address: Record<string, any> | null;
  tracking_number: string | null;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  created_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
  metadata: Record<string, any>;
}

export interface ShippingMethodWithUsage extends ShippingMethod {
  usage_count?: number;
  total_revenue?: number;
}

export interface ShippingLine {
  id: string | number;
  method_id: string | number;
  method_title: string;
  method_type: string;
  total: string;
  taxes: any[];
  meta_data: {
    estimated_delivery: string;
    tracking_number: string | null;
    shipping_address?: {
      first_name: string;
      last_name: string;
      address_1: string;
      city: string;
      phone: string;
    };
  };
}



export class ShippingService {
  /**
   * Obtener todos los métodos de envío con paginación
   */
  static async getAllShippingMethods(page: number = 1, limit: number = 10, enabled?: boolean) {
    try {
      if (!supabaseAdmin) {
        console.error('❌ Supabase admin client not available');
        throw new Error('Database connection not available');
      }

      let query = supabaseAdmin
        .from('shipping_methods')
        .select('*', { count: 'exact' })
        .order('id', { ascending: true });

      // Filtrar por enabled si se especifica
      if (enabled !== undefined) {
        query = query.eq('enabled', enabled);
      }

      // Aplicar paginación
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data: shippingMethods, error, count } = await query;

      if (error) {
        console.error('❌ Error fetching shipping methods:', error);
        throw error;
      }

      return {
        shippingMethods: shippingMethods || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      console.error('Error fetching shipping methods:', error);
      throw error;
    }
  }

  /**
   * Obtener método de envío por ID
   */
  static async getShippingMethodById(methodId: string | number): Promise<ShippingMethod | null> {
    try {
      if (!supabaseAdmin) {
        console.error('❌ Supabase admin client not available');
        throw new Error('Database connection not available');
      }

      const { data: method, error } = await supabaseAdmin
        .from('shipping_methods')
        .select('*')
        .eq('id', methodId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        console.error('❌ Error fetching shipping method by ID:', error);
        throw error;
      }

      return method;
    } catch (error) {
      console.error('Error fetching shipping method by ID:', error);
      throw error;
    }
  }

  /**
   * Crear nuevo método de envío
   */
  static async createShippingMethod(methodData: ShippingMethodInsert): Promise<ShippingMethod> {
    try {
      if (!supabaseAdmin) {
        console.error('❌ Supabase admin client not available');
        throw new Error('Database connection not available');
      }

      const { data: newMethod, error } = await supabaseAdmin
        .from('shipping_methods')
        .insert({
          name: methodData.name,
          description: methodData.description || null,
          cost: methodData.cost,
          shipping_type: methodData.shipping_type,
          enabled: methodData.enabled ?? true,
          min_amount: methodData.min_amount || null,
          max_amount: methodData.max_amount || null,
          available_regions: methodData.available_regions || null,
          excluded_regions: methodData.excluded_regions || null,
          estimated_days_min: methodData.estimated_days_min,
          estimated_days_max: methodData.estimated_days_max,
          requires_address: methodData.requires_address ?? true,
          requires_phone: methodData.requires_phone ?? true,
          metadata: methodData.metadata || {}
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating shipping method:', error);
        throw error;
      }

      return newMethod;
    } catch (error) {
      console.error('Error creating shipping method:', error);
      throw error;
    }
  }

  /**
   * Actualizar método de envío
   */
  static async updateShippingMethod(methodId: string | number, updates: ShippingMethodUpdate): Promise<ShippingMethod> {
    try {
      if (!supabaseAdmin) {
        console.error('❌ Supabase admin client not available');
        throw new Error('Database connection not available');
      }

      const { data: updatedMethod, error } = await supabaseAdmin
        .from('shipping_methods')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', methodId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Método de envío no encontrado');
        }
        console.error('❌ Error updating shipping method:', error);
        throw error;
      }

      return updatedMethod;
    } catch (error) {
      console.error('Error updating shipping method:', error);
      throw error;
    }
  }

  /**
   * Eliminar método de envío
   */
  static async deleteShippingMethod(methodId: string | number): Promise<boolean> {
    try {
      if (!supabaseAdmin) {
        console.error('❌ Supabase admin client not available');
        throw new Error('Database connection not available');
      }

      const { error } = await supabaseAdmin
        .from('shipping_methods')
        .delete()
        .eq('id', methodId);

      if (error) {
        console.error('❌ Error deleting shipping method:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error deleting shipping method:', error);
      throw error;
    }
  }

  /**
   * Buscar métodos de envío
   */
  static async searchShippingMethods(searchTerm: string, page: number = 1, limit: number = 10) {
    try {
      if (!supabaseAdmin) {
        console.error('❌ Supabase admin client not available');
        throw new Error('Database connection not available');
      }

      const offset = (page - 1) * limit;
      
      const { data: shippingMethods, error, count } = await supabaseAdmin
        .from('shipping_methods')
        .select('*', { count: 'exact' })
        .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .order('id', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('❌ Error searching shipping methods:', error);
        throw error;
      }

      return {
        shippingMethods: shippingMethods || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
        searchTerm
      };
    } catch (error) {
      console.error('Error searching shipping methods:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de métodos de envío
   */
  static async getShippingStats() {
    try {
      if (!supabaseAdmin) {
        console.error('❌ Supabase admin client not available');
        throw new Error('Database connection not available');
      }

      // Obtener estadísticas de métodos de envío
      const { data: allMethods, error: methodsError } = await supabaseAdmin
        .from('shipping_methods')
        .select('enabled');

      if (methodsError) {
        console.error('❌ Error fetching shipping methods for stats:', methodsError);
        throw methodsError;
      }

      const totalMethods = allMethods?.length || 0;
      const activeMethods = allMethods?.filter(m => m.enabled).length || 0;
      
      // TODO: Implementar estadísticas reales de envíos cuando esté disponible la tabla shipping_usage
      const mockStats = {
        totalMethods,
        activeMethods,
        totalShipments: 156,
        pendingShipments: 23,
        deliveredShipments: 128,
        totalRevenue: '2450000.00',
        deliveryRate: '82.1'
      };

      return mockStats;
    } catch (error) {
      console.error('Error fetching shipping stats:', error);
      throw error;
    }
  }

  /**
   * Validar método de envío
   */
  static validateShippingMethod(
    method: ShippingMethod,
    cartTotal: number,
    region?: string
  ): {
    isValid: boolean;
    message?: string;
  } {
    // Verificar si está habilitado
    if (!method.enabled) {
      return {
        isValid: false,
        message: 'Método de envío no disponible'
      };
    }

    // Verificar monto mínimo
    if (method.min_amount && cartTotal < parseFloat(method.min_amount)) {
      return {
        isValid: false,
        message: `Monto mínimo requerido: $${parseFloat(method.min_amount).toLocaleString()}`
      };
    }

    // Verificar monto máximo
    if (method.max_amount && cartTotal > parseFloat(method.max_amount)) {
      return {
        isValid: false,
        message: `Monto máximo permitido: $${parseFloat(method.max_amount).toLocaleString()}`
      };
    }

    // Verificar región disponible
    if (region && method.available_regions && method.available_regions.length > 0) {
      if (!method.available_regions.includes(region)) {
        return {
          isValid: false,
          message: 'No disponible en tu región'
        };
      }
    }

    // Verificar región excluida
    if (region && method.excluded_regions && method.excluded_regions.length > 0) {
      if (method.excluded_regions.includes(region)) {
        return {
          isValid: false,
          message: 'No disponible en tu región'
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Crear línea de envío para incluir en la orden
   */
  static createShippingLine(
    method: ShippingMethod,
    shippingAddress?: {
      first_name: string;
      last_name: string;
      address_1: string;
      city: string;
      phone: string;
    }
  ): ShippingLine {
    return {
      id: method.id,
      method_id: method.id,
      method_title: method.name,
      method_type: method.shipping_type,
      total: method.cost,
      taxes: [],
      meta_data: {
        estimated_delivery: formatDeliveryTime(method.estimated_days_min, method.estimated_days_max),
        tracking_number: null,
        ...(shippingAddress && { shipping_address: shippingAddress })
      }
    };
  }
}

// Utilidades para formateo
export const formatShippingCost = (cost: string | number): string => {
  const numericCost = typeof cost === 'string' ? parseFloat(cost) : cost;
  if (numericCost === 0) return 'Gratis';
  return `$${numericCost.toLocaleString('es-CL')}`;
};

export const formatDeliveryTime = (minDays: string | number, maxDays: string | number): string => {
  const numericMinDays = typeof minDays === 'string' ? parseInt(minDays) : minDays;
  const numericMaxDays = typeof maxDays === 'string' ? parseInt(maxDays) : maxDays;
  
  if (numericMinDays === numericMaxDays) {
    return `${numericMinDays} ${numericMinDays === 1 ? 'día' : 'días'}`;
  }
  return `${numericMinDays}-${numericMaxDays} días`;
};

export const getShippingTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    free: 'Envío Gratis',
    flat_rate: 'Tarifa Fija',
    local_pickup: 'Retiro en Tienda',
    calculated: 'Calculado',
    express: 'Express'
  };
  return labels[type] || type;
};

export const getShippingStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    processing: 'Procesando',
    shipped: 'Enviado',
    delivered: 'Entregado',
    cancelled: 'Cancelado'
  };
  return labels[status] || status;
};

export default ShippingService;
