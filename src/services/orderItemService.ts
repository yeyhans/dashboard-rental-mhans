import { supabaseAdmin } from '../lib/supabase';
import type { Database } from '../types/database';

type OrderItem = Database['public']['Tables']['order_items']['Row'];
type OrderItemInsert = Database['public']['Tables']['order_items']['Insert'];
type OrderItemUpdate = Database['public']['Tables']['order_items']['Update'];

export class OrderItemService {
  /**
   * Obtener todos los items de una orden
   */
  static async getOrderItems(orderId: number): Promise<OrderItem[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('order_items')
        .select(`
          *,
          products (
            id,
            name,
            price,
            image_url
          )
        `)
        .eq('order_id', orderId)
        .order('id');

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching order items:', error);
      throw error;
    }
  }

  /**
   * Obtener item por ID
   */
  static async getOrderItemById(itemId: number): Promise<OrderItem | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('order_items')
        .select(`
          *,
          products (
            id,
            name,
            price,
            image_url
          )
        `)
        .eq('id', itemId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching order item by ID:', error);
      throw error;
    }
  }

  /**
   * Crear nuevo item de orden
   */
  static async createOrderItem(itemData: OrderItemInsert): Promise<OrderItem> {
    try {
      const { data, error } = await supabaseAdmin
        .from('order_items')
        .insert([itemData])
        .select(`
          *,
          products (
            id,
            name,
            price,
            image_url
          )
        `)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error creating order item:', error);
      throw error;
    }
  }

  /**
   * Crear múltiples items de orden
   */
  static async createOrderItems(itemsData: OrderItemInsert[]): Promise<OrderItem[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('order_items')
        .insert(itemsData)
        .select(`
          *,
          products (
            id,
            name,
            price,
            image_url
          )
        `);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error creating order items:', error);
      throw error;
    }
  }

  /**
   * Actualizar item de orden
   */
  static async updateOrderItem(itemId: number, updates: OrderItemUpdate): Promise<OrderItem> {
    try {
      const { data, error } = await supabaseAdmin
        .from('order_items')
        .update(updates)
        .eq('id', itemId)
        .select(`
          *,
          products (
            id,
            name,
            price,
            image_url
          )
        `)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error updating order item:', error);
      throw error;
    }
  }

  /**
   * Eliminar item de orden
   */
  static async deleteOrderItem(itemId: number): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('order_items')
        .delete()
        .eq('id', itemId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error deleting order item:', error);
      throw error;
    }
  }

  /**
   * Eliminar todos los items de una orden
   */
  static async deleteOrderItems(orderId: number): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('order_items')
        .delete()
        .eq('order_id', orderId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error deleting order items:', error);
      throw error;
    }
  }

  /**
   * Actualizar cantidad de un item
   */
  static async updateItemQuantity(itemId: number, quantity: number): Promise<OrderItem> {
    try {
      if (quantity <= 0) {
        throw new Error('La cantidad debe ser mayor a 0');
      }

      // Obtener el item actual para recalcular el total
      const currentItem = await this.getOrderItemById(itemId);
      if (!currentItem) {
        throw new Error('Item no encontrado');
      }

      const newTotal = currentItem.product_price * quantity;

      const { data, error } = await supabaseAdmin
        .from('order_items')
        .update({
          quantity,
          total: newTotal
        })
        .eq('id', itemId)
        .select(`
          *,
          products (
            id,
            name,
            price,
            image_url
          )
        `)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error updating item quantity:', error);
      throw error;
    }
  }

  /**
   * Calcular total de items de una orden
   */
  static async calculateOrderTotal(orderId: number): Promise<number> {
    try {
      const { data, error } = await supabaseAdmin
        .from('order_items')
        .select('total')
        .eq('order_id', orderId);

      if (error) {
        throw error;
      }

      return data.reduce((sum, item) => sum + (item.total || 0), 0);
    } catch (error) {
      console.error('Error calculating order total:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de items más vendidos
   */
  static async getTopSellingItems(limit: number = 10) {
    try {
      const { data, error } = await supabaseAdmin
        .from('order_items')
        .select(`
          product_id,
          product_name,
          quantity,
          products (
            name,
            image_url,
            price
          )
        `)
        .order('quantity', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      // Agrupar por producto y sumar cantidades
      const productSales = data.reduce((acc: any, item) => {
        const productId = item.product_id;
        if (!acc[productId]) {
          acc[productId] = {
            product_id: productId,
            product_name: item.product_name,
            total_quantity: 0,
            product_info: item.products
          };
        }
        acc[productId].total_quantity += item.quantity;
        return acc;
      }, {});

      return Object.values(productSales)
        .sort((a: any, b: any) => b.total_quantity - a.total_quantity)
        .slice(0, limit);
    } catch (error) {
      console.error('Error fetching top selling items:', error);
      throw error;
    }
  }

  /**
   * Obtener items por producto
   */
  static async getItemsByProduct(productId: number, page: number = 1, limit: number = 10) {
    try {
      const offset = (page - 1) * limit;
      
      const { data, error, count } = await supabaseAdmin
        .from('order_items')
        .select(`
          *,
          orders (
            id,
            status,
            date_created,
            billing_first_name,
            billing_last_name
          )
        `, { count: 'exact' })
        .eq('product_id', productId)
        .order('id', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return {
        items: data,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      console.error('Error fetching items by product:', error);
      throw error;
    }
  }

  /**
   * Validar stock antes de crear item
   */
  static async validateStock(productId: number, requestedQuantity: number): Promise<boolean> {
    try {
      const { data: product, error } = await supabaseAdmin
        .from('products')
        .select('stock_quantity, manage_stock')
        .eq('id', productId)
        .single();

      if (error) {
        throw error;
      }

      // Si no maneja stock, siempre es válido
      if (!product.manage_stock) {
        return true;
      }

      // Verificar si hay suficiente stock
      return (product.stock_quantity || 0) >= requestedQuantity;
    } catch (error) {
      console.error('Error validating stock:', error);
      return false;
    }
  }
}
