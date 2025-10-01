// Servicio de envíos con datos mock hasta implementar las tablas en la base de datos

// Tipos para el sistema de envíos
export interface ShippingMethod {
  id: number;
  name: string;
  description: string | null;
  cost: number;
  shipping_type: 'free' | 'flat_rate' | 'local_pickup' | 'calculated' | 'express';
  enabled: boolean;
  min_amount: number | null;
  max_amount: number | null;
  available_regions?: string[] | null;
  excluded_regions?: string[] | null;
  estimated_days_min: number;
  estimated_days_max: number;
  requires_address: boolean;
  requires_phone: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ShippingMethodInsert {
  id?: number;
  name: string;
  description?: string | null;
  cost: number;
  shipping_type: 'free' | 'flat_rate' | 'local_pickup' | 'calculated' | 'express';
  enabled?: boolean;
  min_amount?: number | null;
  max_amount?: number | null;
  available_regions?: string[] | null;
  excluded_regions?: string[] | null;
  estimated_days_min: number;
  estimated_days_max: number;
  requires_address?: boolean;
  requires_phone?: boolean;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface ShippingMethodUpdate {
  id?: number;
  name?: string;
  description?: string | null;
  cost?: number;
  shipping_type?: 'free' | 'flat_rate' | 'local_pickup' | 'calculated' | 'express';
  enabled?: boolean;
  min_amount?: number | null;
  max_amount?: number | null;
  available_regions?: string[] | null;
  excluded_regions?: string[] | null;
  estimated_days_min?: number;
  estimated_days_max?: number;
  requires_address?: boolean;
  requires_phone?: boolean;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
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
  id: number;
  method_id: number;
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

// Datos mock para desarrollo
const mockShippingMethods: ShippingMethod[] = [
  {
    id: 1,
    name: 'Envío Gratis',
    description: 'Envío gratuito para compras sobre $50.000',
    cost: 0,
    shipping_type: 'free',
    enabled: true,
    min_amount: 50000,
    max_amount: null,
    available_regions: ['RM', 'V', 'VIII'],
    excluded_regions: null,
    estimated_days_min: 3,
    estimated_days_max: 5,
    requires_address: true,
    requires_phone: true,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 2,
    name: 'Envío Estándar',
    description: 'Envío estándar a todo Chile',
    cost: 5000,
    shipping_type: 'flat_rate',
    enabled: true,
    min_amount: null,
    max_amount: null,
    available_regions: null,
    excluded_regions: null,
    estimated_days_min: 2,
    estimated_days_max: 4,
    requires_address: true,
    requires_phone: true,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 3,
    name: 'Envío Express',
    description: 'Entrega en 24 horas',
    cost: 12000,
    shipping_type: 'express',
    enabled: true,
    min_amount: null,
    max_amount: null,
    available_regions: ['RM'],
    excluded_regions: null,
    estimated_days_min: 1,
    estimated_days_max: 1,
    requires_address: true,
    requires_phone: true,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 4,
    name: 'Retiro en Tienda',
    description: 'Retira tu pedido en nuestra tienda',
    cost: 0,
    shipping_type: 'local_pickup',
    enabled: true,
    min_amount: null,
    max_amount: null,
    available_regions: ['RM'],
    excluded_regions: null,
    estimated_days_min: 0,
    estimated_days_max: 1,
    requires_address: false,
    requires_phone: true,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export class ShippingService {
  /**
   * Obtener todos los métodos de envío con paginación
   */
  static async getAllShippingMethods(page: number = 1, limit: number = 10, enabled?: boolean) {
    try {
      // Filtrar por enabled si se especifica
      let filteredMethods = mockShippingMethods;
      if (enabled !== undefined) {
        filteredMethods = mockShippingMethods.filter(method => method.enabled === enabled);
      }

      // Aplicar paginación
      const offset = (page - 1) * limit;
      const paginatedMethods = filteredMethods.slice(offset, offset + limit);

      return {
        shippingMethods: paginatedMethods,
        total: filteredMethods.length,
        page,
        limit,
        totalPages: Math.ceil(filteredMethods.length / limit)
      };
    } catch (error) {
      console.error('Error fetching shipping methods:', error);
      throw error;
    }
  }

  /**
   * Obtener método de envío por ID
   */
  static async getShippingMethodById(methodId: number): Promise<ShippingMethod | null> {
    try {
      const method = mockShippingMethods.find(m => m.id === methodId);
      return method || null;
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
      const newId = Math.max(...mockShippingMethods.map(m => m.id)) + 1;
      const newMethod: ShippingMethod = {
        id: newId,
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
        metadata: methodData.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockShippingMethods.push(newMethod);
      return newMethod;
    } catch (error) {
      console.error('Error creating shipping method:', error);
      throw error;
    }
  }

  /**
   * Actualizar método de envío
   */
  static async updateShippingMethod(methodId: number, updates: ShippingMethodUpdate): Promise<ShippingMethod> {
    try {
      const methodIndex = mockShippingMethods.findIndex(m => m.id === methodId);
      if (methodIndex === -1) {
        throw new Error('Método de envío no encontrado');
      }

      const updatedMethod = {
        ...mockShippingMethods[methodIndex],
        ...updates,
        updated_at: new Date().toISOString()
      };

      mockShippingMethods[methodIndex] = updatedMethod;
      return updatedMethod;
    } catch (error) {
      console.error('Error updating shipping method:', error);
      throw error;
    }
  }

  /**
   * Eliminar método de envío
   */
  static async deleteShippingMethod(methodId: number): Promise<boolean> {
    try {
      const methodIndex = mockShippingMethods.findIndex(m => m.id === methodId);
      if (methodIndex === -1) {
        throw new Error('Método de envío no encontrado');
      }

      mockShippingMethods.splice(methodIndex, 1);
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
      const filteredMethods = mockShippingMethods.filter(method =>
        method.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (method.description && method.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );

      const offset = (page - 1) * limit;
      const paginatedMethods = filteredMethods.slice(offset, offset + limit);

      return {
        shippingMethods: paginatedMethods,
        total: filteredMethods.length,
        page,
        limit,
        totalPages: Math.ceil(filteredMethods.length / limit),
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
      const totalMethods = mockShippingMethods.length;
      const activeMethods = mockShippingMethods.filter(m => m.enabled).length;
      
      // Datos mock para estadísticas
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
    if (method.min_amount && cartTotal < method.min_amount) {
      return {
        isValid: false,
        message: `Monto mínimo requerido: $${method.min_amount.toLocaleString()}`
      };
    }

    // Verificar monto máximo
    if (method.max_amount && cartTotal > method.max_amount) {
      return {
        isValid: false,
        message: `Monto máximo permitido: $${method.max_amount.toLocaleString()}`
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
      total: method.cost.toString(),
      taxes: [],
      meta_data: {
        estimated_delivery: `${method.estimated_days_min}-${method.estimated_days_max} días`,
        tracking_number: null,
        ...(shippingAddress && { shipping_address: shippingAddress })
      }
    };
  }
}

// Utilidades para formateo
export const formatShippingCost = (cost: number): string => {
  if (cost === 0) return 'Gratis';
  return `$${cost.toLocaleString('es-CL')}`;
};

export const formatDeliveryTime = (minDays: number, maxDays: number): string => {
  if (minDays === maxDays) {
    return `${minDays} ${minDays === 1 ? 'día' : 'días'}`;
  }
  return `${minDays}-${maxDays} días`;
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
