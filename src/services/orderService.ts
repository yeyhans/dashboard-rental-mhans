import { supabaseAdmin } from '../lib/supabase';
import type { Database } from '../types/database';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderInsert = Database['public']['Tables']['orders']['Insert'];
type OrderUpdate = Database['public']['Tables']['orders']['Update'];

export class OrderService {
  /**
   * Obtener solo órdenes completadas para tabla de pagos
   */
  static async getCompletedOrders(page: number = 1, limit: number = 10) {
    try {
      if (!supabaseAdmin) {
        throw new Error('Supabase admin client is not initialized');
      }

      const offset = (page - 1) * limit;
      
      const query = supabaseAdmin
        .from('orders')
        .select(`
          id,
          status,
          currency,
          date_created,
          date_modified,
          date_completed,
          date_paid,
          customer_id,
          calculated_subtotal,
          calculated_discount,
          calculated_iva,
          calculated_total,
          shipping_total,
          cart_tax,
          total,
          total_tax,
          billing_first_name,
          billing_last_name,
          billing_company,
          billing_address_1,
          billing_city,
          billing_email,
          billing_phone,
          order_proyecto,
          order_fecha_inicio,
          order_fecha_termino,
          num_jornadas,
          company_rut,
          order_retire_name,
          order_retire_phone,
          order_retire_rut,
          order_comments,
          line_items,
          payment_method,
          payment_method_title,
          transaction_id,
          order_key,
          customer_ip_address,
          customer_user_agent,
          created_via,
          customer_note,
          correo_enviado,
          pago_completo,
          is_editable,
          needs_payment,
          needs_processing,
          fotos_garantia,
          orden_compra,
          numero_factura,
          new_pdf_on_hold_url,
          new_pdf_processing_url,
          tax_lines,
          shipping_lines,
          fee_lines,
          coupon_lines,
          refunds,
          user_profiles (
            user_id,
            nombre,
            apellido,
            email,
            rut
          )
        `, { count: 'exact' })
        .eq('status', 'completed')
        .order('date_completed', { ascending: false });

      const { data, error, count } = await query
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      // Ensure all completed orders have required calculated fields
      const ordersWithCalculatedFields = data?.map(order => ({
        ...order,
        calculated_subtotal: order.calculated_subtotal || 0,
        calculated_discount: order.calculated_discount || 0,
        calculated_iva: order.calculated_iva || 0,
        calculated_total: order.calculated_total || order.total || 0,
        total: order.total || 0,
        shipping_total: order.shipping_total || 0,
        cart_tax: order.cart_tax || 0,
        total_tax: order.total_tax || 0
      })) || [];

      return {
        orders: ordersWithCalculatedFields,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      console.error('Error fetching completed orders:', error);
      throw error;
    }
  }

  /**
   * Obtener todas las órdenes con paginación
   */
  static async getAllOrders(page: number = 1, limit: number = 10, status?: string) {
    try {
      const offset = (page - 1) * limit;
      
      let query = supabaseAdmin
        .from('orders')
        .select(`
          id,
          status,
          currency,
          date_created,
          date_modified,
          date_completed,
          date_paid,
          customer_id,
          calculated_subtotal,
          calculated_discount,
          calculated_iva,
          calculated_total,
          shipping_total,
          cart_tax,
          total,
          total_tax,
          billing_first_name,
          billing_last_name,
          billing_company,
          billing_address_1,
          billing_city,
          billing_email,
          billing_phone,
          order_proyecto,
          order_fecha_inicio,
          order_fecha_termino,
          num_jornadas,
          company_rut,
          order_retire_name,
          order_retire_phone,
          order_retire_rut,
          order_comments,
          line_items,
          payment_method,
          payment_method_title,
          transaction_id,
          order_key,
          customer_ip_address,
          customer_user_agent,
          created_via,
          customer_note,
          correo_enviado,
          pago_completo,
          is_editable,
          needs_payment,
          needs_processing,
          fotos_garantia,
          orden_compra,
          numero_factura,
          new_pdf_on_hold_url,
          new_pdf_processing_url,
          tax_lines,
          shipping_lines,
          fee_lines,
          coupon_lines,
          refunds,
          user_profiles (
            user_id,
            nombre,
            apellido,
            email,
            rut
          )
        `, { count: 'exact' })
        .order('date_created', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error, count } = await query
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      // Ensure all orders have required calculated fields
      const ordersWithCalculatedFields = data?.map(order => ({
        ...order,
        calculated_subtotal: order.calculated_subtotal || 0,
        calculated_discount: order.calculated_discount || 0,
        calculated_iva: order.calculated_iva || 0,
        calculated_total: order.calculated_total || order.total || 0,
        total: order.total || 0,
        shipping_total: order.shipping_total || 0,
        cart_tax: order.cart_tax || 0,
        total_tax: order.total_tax || 0
      })) || [];

      return {
        orders: ordersWithCalculatedFields,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  }

  /**
   * Obtener orden por ID
   */
  static async getOrderById(orderId: number): Promise<Order | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('orders')
        .select(`
          id,
          status,
          currency,
          date_created,
          date_modified,
          date_completed,
          date_paid,
          customer_id,
          calculated_subtotal,
          calculated_discount,
          calculated_iva,
          calculated_total,
          shipping_total,
          cart_tax,
          total,
          total_tax,
          billing_first_name,
          billing_last_name,
          billing_company,
          billing_address_1,
          billing_city,
          billing_email,
          billing_phone,
          order_proyecto,
          order_fecha_inicio,
          order_fecha_termino,
          num_jornadas,
          company_rut,
          order_retire_name,
          order_retire_phone,
          order_retire_rut,
          order_comments,
          line_items,
          payment_method,
          payment_method_title,
          transaction_id,
          order_key,
          customer_ip_address,
          customer_user_agent,
          created_via,
          customer_note,
          correo_enviado,
          pago_completo,
          is_editable,
          needs_payment,
          needs_processing,
          fotos_garantia,
          orden_compra,
          numero_factura,
          new_pdf_on_hold_url,
          new_pdf_processing_url,
          tax_lines,
          shipping_lines,
          fee_lines,
          coupon_lines,
          refunds,
          user_profiles (
            user_id,
            nombre,
            apellido,
            email,
            rut,
            telefono,
            direccion,
            ciudad
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      // Ensure the order has required calculated fields
      const orderWithCalculatedFields = {
        ...data,
        calculated_subtotal: data.calculated_subtotal || 0,
        calculated_discount: data.calculated_discount || 0,
        calculated_iva: data.calculated_iva || 0,
        calculated_total: data.calculated_total || data.total || 0,
        total: data.total || 0,
        shipping_total: data.shipping_total || 0,
        cart_tax: data.cart_tax || 0,
        total_tax: data.total_tax || 0
      };

      return orderWithCalculatedFields;
    } catch (error) {
      console.error('Error fetching order by ID:', error);
      throw error;
    }
  }

  /**
   * Crear nueva orden
   */
  static async createOrder(orderData: OrderInsert): Promise<Order> {
    try {
      const { data, error } = await supabaseAdmin
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Ensure the created order has required calculated fields
      const orderWithCalculatedFields = {
        ...data,
        calculated_subtotal: data.calculated_subtotal || 0,
        calculated_discount: data.calculated_discount || 0,
        calculated_iva: data.calculated_iva || 0,
        calculated_total: data.calculated_total || data.total || 0,
        total: data.total || 0,
        shipping_total: data.shipping_total || 0,
        cart_tax: data.cart_tax || 0,
        total_tax: data.total_tax || 0
      };

      return orderWithCalculatedFields;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  /**
   * Actualizar orden
   */
  static async updateOrder(orderId: number, updates: OrderUpdate): Promise<Order> {
    try {
      console.log('🔄 OrderService.updateOrder - Order ID:', orderId);
      console.log('📤 OrderService.updateOrder - Updates:', JSON.stringify(updates, null, 2));
      
      const { data, error } = await supabaseAdmin
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();
        
      console.log('📡 Supabase response error:', error);
      console.log('📡 Supabase response data:', data);

      if (error) {
        throw error;
      }

      // Ensure the updated order has required calculated fields
      const orderWithCalculatedFields = {
        ...data,
        calculated_subtotal: data.calculated_subtotal || 0,
        calculated_discount: data.calculated_discount || 0,
        calculated_iva: data.calculated_iva || 0,
        calculated_total: data.calculated_total || data.total || 0,
        total: data.total || 0,
        shipping_total: data.shipping_total || 0,
        cart_tax: data.cart_tax || 0,
        total_tax: data.total_tax || 0
      };

      return orderWithCalculatedFields;
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  }

  /**
   * Eliminar orden
   */
  static async deleteOrder(orderId: number): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error deleting order:', error);
      throw error;
    }
  }

  /**
   * Buscar órdenes
   */
  static async searchOrders(searchTerm: string, page: number = 1, limit: number = 10) {
    try {
      const offset = (page - 1) * limit;
      
      const { data, error, count } = await supabaseAdmin
        .from('orders')
        .select(`
          id,
          status,
          currency,
          date_created,
          date_modified,
          date_completed,
          date_paid,
          customer_id,
          calculated_subtotal,
          calculated_discount,
          calculated_iva,
          calculated_total,
          shipping_total,
          cart_tax,
          total,
          total_tax,
          billing_first_name,
          billing_last_name,
          billing_company,
          billing_address_1,
          billing_city,
          billing_email,
          billing_phone,
          order_proyecto,
          order_fecha_inicio,
          order_fecha_termino,
          num_jornadas,
          company_rut,
          order_retire_name,
          order_retire_phone,
          order_retire_rut,
          order_comments,
          line_items,
          payment_method,
          payment_method_title,
          transaction_id,
          order_key,
          customer_ip_address,
          customer_user_agent,
          created_via,
          customer_note,
          correo_enviado,
          pago_completo,
          is_editable,
          needs_payment,
          needs_processing,
          fotos_garantia,
          orden_compra,
          numero_factura,
          new_pdf_on_hold_url,
          new_pdf_processing_url,
          tax_lines,
          shipping_lines,
          fee_lines,
          coupon_lines,
          refunds,
          user_profiles (
            user_id,
            nombre,
            apellido,
            email,
            rut
          )
        `, { count: 'exact' })
        .or(`billing_email.ilike.%${searchTerm}%,billing_first_name.ilike.%${searchTerm}%,billing_last_name.ilike.%${searchTerm}%,order_proyecto.ilike.%${searchTerm}%,company_rut.ilike.%${searchTerm}%`)
        .order('date_created', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      // Ensure all search results have required calculated fields
      const ordersWithCalculatedFields = data?.map(order => ({
        ...order,
        calculated_subtotal: order.calculated_subtotal || 0,
        calculated_discount: order.calculated_discount || 0,
        calculated_iva: order.calculated_iva || 0,
        calculated_total: order.calculated_total || order.total || 0,
        total: order.total || 0,
        shipping_total: order.shipping_total || 0,
        cart_tax: order.cart_tax || 0,
        total_tax: order.total_tax || 0
      })) || [];

      return {
        orders: ordersWithCalculatedFields,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
        searchTerm
      };
    } catch (error) {
      console.error('Error searching orders:', error);
      throw error;
    }
  }

  /**
   * Obtener órdenes por usuario
   */
  static async getOrdersByUser(userId: number, page: number = 1, limit: number = 10) {
    try {
      const offset = (page - 1) * limit;
      
      const { data, error, count } = await supabaseAdmin
        .from('orders')
        .select(`
          id,
          status,
          currency,
          date_created,
          date_modified,
          date_completed,
          date_paid,
          customer_id,
          calculated_subtotal,
          calculated_discount,
          calculated_iva,
          calculated_total,
          shipping_total,
          cart_tax,
          total,
          total_tax,
          billing_first_name,
          billing_last_name,
          billing_company,
          billing_address_1,
          billing_city,
          billing_email,
          billing_phone,
          order_proyecto,
          order_fecha_inicio,
          order_fecha_termino,
          num_jornadas,
          company_rut,
          order_retire_name,
          order_retire_phone,
          order_retire_rut,
          order_comments,
          line_items,
          payment_method,
          payment_method_title,
          transaction_id,
          order_key,
          customer_ip_address,
          customer_user_agent,
          created_via,
          customer_note,
          correo_enviado,
          pago_completo,
          is_editable,
          needs_payment,
          needs_processing,
          fotos_garantia,
          orden_compra,
          numero_factura,
          new_pdf_on_hold_url,
          new_pdf_processing_url,
          tax_lines,
          shipping_lines,
          fee_lines,
          coupon_lines,
          refunds,
          user_profiles (
            user_id,
            nombre,
            apellido,
            email,
            rut
          )
        `, { count: 'exact' })
        .eq('customer_id', userId)
        .order('date_created', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      // Ensure all user orders have required calculated fields
      const ordersWithCalculatedFields = data?.map(order => ({
        ...order,
        calculated_subtotal: order.calculated_subtotal || 0,
        calculated_discount: order.calculated_discount || 0,
        calculated_iva: order.calculated_iva || 0,
        calculated_total: order.calculated_total || order.total || 0,
        total: order.total || 0,
        shipping_total: order.shipping_total || 0,
        cart_tax: order.cart_tax || 0,
        total_tax: order.total_tax || 0
      })) || [];

      return {
        orders: ordersWithCalculatedFields,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
        userId
      };
    } catch (error) {
      console.error('Error fetching orders by user:', error);
      throw error;
    }
  }

  /**
   * Obtener órdenes por rango de fechas
   */
  static async getOrdersByDateRange(startDate: string, endDate: string, page: number = 1, limit: number = 10) {
    try {
      const offset = (page - 1) * limit;
      
      const { data, error, count } = await supabaseAdmin
        .from('orders')
        .select(`
          id,
          status,
          currency,
          date_created,
          date_modified,
          date_completed,
          date_paid,
          customer_id,
          calculated_subtotal,
          calculated_discount,
          calculated_iva,
          calculated_total,
          shipping_total,
          cart_tax,
          total,
          total_tax,
          billing_first_name,
          billing_last_name,
          billing_company,
          billing_address_1,
          billing_city,
          billing_email,
          billing_phone,
          order_proyecto,
          order_fecha_inicio,
          order_fecha_termino,
          num_jornadas,
          company_rut,
          order_retire_name,
          order_retire_phone,
          order_retire_rut,
          order_comments,
          line_items,
          payment_method,
          payment_method_title,
          transaction_id,
          order_key,
          customer_ip_address,
          customer_user_agent,
          created_via,
          customer_note,
          correo_enviado,
          pago_completo,
          is_editable,
          needs_payment,
          needs_processing,
          fotos_garantia,
          orden_compra,
          numero_factura,
          new_pdf_on_hold_url,
          new_pdf_processing_url,
          tax_lines,
          shipping_lines,
          fee_lines,
          coupon_lines,
          refunds,
          user_profiles (
            user_id,
            nombre,
            apellido,
            email,
            rut
          )
        `, { count: 'exact' })
        .gte('date_created', startDate)
        .lte('date_created', endDate)
        .order('date_created', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      // Ensure all date range orders have required calculated fields
      const ordersWithCalculatedFields = data?.map(order => ({
        ...order,
        calculated_subtotal: order.calculated_subtotal || 0,
        calculated_discount: order.calculated_discount || 0,
        calculated_iva: order.calculated_iva || 0,
        calculated_total: order.calculated_total || order.total || 0,
        total: order.total || 0,
        shipping_total: order.shipping_total || 0,
        cart_tax: order.cart_tax || 0,
        total_tax: order.total_tax || 0
      })) || [];

      return {
        orders: ordersWithCalculatedFields,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
        startDate,
        endDate
      };
    } catch (error) {
      console.error('Error fetching orders by date range:', error);
      throw error;
    }
  }

  /**
   * Actualizar estado de orden
   */
  static async updateOrderStatus(orderId: number, status: string, notes?: string): Promise<Order> {
    try {
      const updates: OrderUpdate = {
        status,
        date_modified: new Date().toISOString()
      };

      if (status === 'completed') {
        updates.date_completed = new Date().toISOString();
      }

      if (notes) {
        updates.customer_note = notes;
      }

      const { data, error } = await supabaseAdmin
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Ensure the status updated order has required calculated fields
      const orderWithCalculatedFields = {
        ...data,
        calculated_subtotal: data.calculated_subtotal || 0,
        calculated_discount: data.calculated_discount || 0,
        calculated_iva: data.calculated_iva || 0,
        calculated_total: data.calculated_total || data.total || 0,
        total: data.total || 0,
        shipping_total: data.shipping_total || 0,
        cart_tax: data.cart_tax || 0,
        total_tax: data.total_tax || 0
      };

      return orderWithCalculatedFields;
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de órdenes
   */
  static async getOrderStats() {
    try {
      // Total de órdenes
      const { count: totalOrders, error: totalError } = await supabaseAdmin
        .from('orders')
        .select('*', { count: 'exact', head: true });

      if (totalError) throw totalError;

      // Órdenes por estado
      const { data: statusData, error: statusError } = await supabaseAdmin
        .from('orders')
        .select('status')
        .order('status');

      if (statusError) throw statusError;

      const statusCounts = statusData.reduce((acc: any, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {});

      // Ingresos totales
      const { data: revenueData, error: revenueError } = await supabaseAdmin
        .from('orders')
        .select('calculated_total')
        .eq('status', 'completed');

      if (revenueError) throw revenueError;

      const totalRevenue = revenueData.reduce((sum, order) => sum + (order.calculated_total || 0), 0);

      // Órdenes del mes actual
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);

      const { count: monthlyOrders, error: monthlyError } = await supabaseAdmin
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('date_created', currentMonth.toISOString());

      if (monthlyError) throw monthlyError;

      // Promedio de valor de orden
      const averageOrderValue = totalOrders ? (totalRevenue / totalOrders).toFixed(2) : '0';

      return {
        totalOrders: totalOrders || 0,
        statusCounts,
        totalRevenue: totalRevenue.toFixed(2),
        monthlyOrders: monthlyOrders || 0,
        averageOrderValue,
        pendingOrders: statusCounts['pending'] || 0,
        processingOrders: statusCounts['processing'] || 0,
        completedOrders: statusCounts['completed'] || 0,
        cancelledOrders: statusCounts['cancelled'] || 0
      };
    } catch (error) {
      console.error('Error fetching order stats:', error);
      throw error;
    }
  }

  /**
   * Verificar conflictos de productos en las mismas jornadas
   */
  static async checkProductConflicts(
    currentOrderId: number,
    productIds: number[],
    startDate: string,
    endDate: string
  ) {
    try {
      if (!productIds.length || !startDate || !endDate) {
        return [];
      }

      // Buscar órdenes que tengan los mismos productos en el rango de fechas
      const { data, error } = await supabaseAdmin
        .from('orders')
        .select(`
          id,
          order_proyecto,
          order_fecha_inicio,
          order_fecha_termino,
          status,
          line_items,
          billing_first_name,
          billing_last_name,
          billing_email
        `)
        .neq('id', currentOrderId) // Excluir la orden actual
        .in('status', ['processing', 'completed', 'on-hold']) // Solo órdenes activas
        .not('order_fecha_inicio', 'is', null)
        .not('order_fecha_termino', 'is', null);

      if (error) {
        throw error;
      }

      const conflicts: Array<{
        orderId: number;
        orderProject: string;
        startDate: string;
        endDate: string;
        status: string;
        customerName: string;
        customerEmail: string;
        conflictingProducts: Array<{
          productId: number;
          productName: string;
          quantity: number;
        }>;
      }> = [];

      // Verificar cada orden para conflictos de fechas y productos
      data?.forEach(order => {
        const orderStart = new Date(order.order_fecha_inicio);
        const orderEnd = new Date(order.order_fecha_termino);
        const currentStart = new Date(startDate);
        const currentEnd = new Date(endDate);

        // Verificar si hay solapamiento de fechas
        const hasDateOverlap = (
          (currentStart <= orderEnd && currentEnd >= orderStart) ||
          (orderStart <= currentEnd && orderEnd >= currentStart)
        );

        if (hasDateOverlap && order.line_items) {
          let orderLineItems: any[] = [];
          
          try {
            // Parsear line_items si es string JSON
            if (typeof order.line_items === 'string') {
              orderLineItems = JSON.parse(order.line_items);
            } else if (Array.isArray(order.line_items)) {
              orderLineItems = order.line_items;
            }
          } catch (e) {
            console.warn('Error parsing line_items for order', order.id, e);
            return;
          }

          // Buscar productos en conflicto
          const conflictingProducts = orderLineItems
            .filter(item => productIds.includes(item.product_id))
            .map(item => ({
              productId: item.product_id,
              productName: item.name || 'Producto sin nombre',
              quantity: item.quantity || 1
            }));

          if (conflictingProducts.length > 0) {
            conflicts.push({
              orderId: order.id,
              orderProject: order.order_proyecto || 'Sin proyecto',
              startDate: order.order_fecha_inicio,
              endDate: order.order_fecha_termino,
              status: order.status,
              customerName: `${order.billing_first_name || ''} ${order.billing_last_name || ''}`.trim() || 'Cliente sin nombre',
              customerEmail: order.billing_email || 'Sin email',
              conflictingProducts
            });
          }
        }
      });

      return conflicts;
    } catch (error) {
      console.error('Error checking product conflicts:', error);
      throw error;
    }
  }

  /**
   * Actualizar fotos de garantía de una orden
   */
  static async updateWarrantyPhotos(orderId: number, photoUrls: string[]): Promise<Order> {
    try {
      const updates: OrderUpdate = {
        fotos_garantia: photoUrls,
        date_modified: new Date().toISOString()
      };

      const { data, error } = await supabaseAdmin
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Ensure the updated order has required calculated fields
      const orderWithCalculatedFields = {
        ...data,
        calculated_subtotal: data.calculated_subtotal || 0,
        calculated_discount: data.calculated_discount || 0,
        calculated_iva: data.calculated_iva || 0,
        calculated_total: data.calculated_total || data.total || 0,
        total: data.total || 0,
        shipping_total: data.shipping_total || 0,
        cart_tax: data.cart_tax || 0,
        total_tax: data.total_tax || 0
      };

      return orderWithCalculatedFields;
    } catch (error) {
      console.error('Error updating warranty photos:', error);
      throw error;
    }
  }

  /**
   * Obtener resumen de ventas por período
   */
  static async getSalesReport(period: 'day' | 'week' | 'month' | 'year' = 'month', limit: number = 30) {
    try {
      let dateFormat: string;
      let interval: string;

      switch (period) {
        case 'day':
          dateFormat = 'YYYY-MM-DD';
          interval = '1 day';
          break;
        case 'week':
          dateFormat = 'YYYY-"W"WW';
          interval = '1 week';
          break;
        case 'month':
          dateFormat = 'YYYY-MM';
          interval = '1 month';
          break;
        case 'year':
          dateFormat = 'YYYY';
          interval = '1 year';
          break;
      }

      const { data, error } = await supabaseAdmin
        .rpc('get_sales_report', {
          date_format: dateFormat,
          period_interval: interval,
          result_limit: limit
        });

      if (error) {
        // Si la función RPC no existe, usar consulta alternativa
        const { data: ordersData, error: ordersError } = await supabaseAdmin
          .from('orders')
          .select('date_created, calculated_total, status')
          .eq('status', 'completed')
          .order('date_created', { ascending: false })
          .limit(1000);

        if (ordersError) throw ordersError;

        // Procesar datos manualmente
        const salesByPeriod = ordersData.reduce((acc: any, order) => {
          const date = new Date(order.date_created);
          let key: string;

          switch (period) {
            case 'day':
              key = date.toISOString().split('T')[0];
              break;
            case 'week':
              const week = getWeekNumber(date);
              key = `${date.getFullYear()}-W${week.toString().padStart(2, '0')}`;
              break;
            case 'month':
              key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
              break;
            case 'year':
              key = date.getFullYear().toString();
              break;
            default:
              key = date.toISOString().split('T')[0];
          }

          if (!acc[key]) {
            acc[key] = { period: key, total_sales: 0, order_count: 0 };
          }

          acc[key].total_sales += order.calculated_total || 0;
          acc[key].order_count += 1;

          return acc;
        }, {});

        return Object.values(salesByPeriod).slice(0, limit);
      }

      return data;
    } catch (error) {
      console.error('Error fetching sales report:', error);
      throw error;
    }
  }
}

// Función auxiliar para obtener número de semana
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
