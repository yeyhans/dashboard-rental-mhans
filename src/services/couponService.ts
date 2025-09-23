import { supabaseAdmin } from '../lib/supabase';
import type { Database } from '../types/database';

type Coupon = Database['public']['Tables']['coupons']['Row'];
type CouponInsert = Database['public']['Tables']['coupons']['Insert'];
type CouponUpdate = Database['public']['Tables']['coupons']['Update'];
type CouponUsage = Database['public']['Tables']['coupon_usage']['Row'];

export class CouponService {
  /**
   * Obtener todos los cupones con paginación
   */
  static async getAllCoupons(page: number = 1, limit: number = 10, status?: string) {
    try {
      const offset = (page - 1) * limit;
      
      let query = supabaseAdmin
        .from('coupons')
        .select('*', { count: 'exact' })
        .order('date_created', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error, count } = await query
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return {
        coupons: data,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      console.error('Error fetching coupons:', error);
      throw error;
    }
  }

  /**
   * Obtener cupón por ID
   */
  static async getCouponById(couponId: number): Promise<Coupon | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('coupons')
        .select('*')
        .eq('id', couponId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching coupon by ID:', error);
      throw error;
    }
  }

  /**
   * Obtener cupón por código
   */
  static async getCouponByCode(code: string): Promise<Coupon | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('coupons')
        .select('*')
        .eq('code', code)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching coupon by code:', error);
      throw error;
    }
  }

  /**
   * Crear nuevo cupón
   */
  static async createCoupon(couponData: CouponInsert): Promise<Coupon> {
    try {
      const { data, error } = await supabaseAdmin
        .from('coupons')
        .insert([couponData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error creating coupon:', error);
      throw error;
    }
  }

  /**
   * Actualizar cupón
   */
  static async updateCoupon(couponId: number, updates: CouponUpdate): Promise<Coupon> {
    try {
      const { data, error } = await supabaseAdmin
        .from('coupons')
        .update({
          ...updates,
          date_modified: new Date().toISOString()
        })
        .eq('id', couponId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error updating coupon:', error);
      throw error;
    }
  }

  /**
   * Eliminar cupón
   */
  static async deleteCoupon(couponId: number): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('coupons')
        .delete()
        .eq('id', couponId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error deleting coupon:', error);
      throw error;
    }
  }

  /**
   * Buscar cupones
   */
  static async searchCoupons(searchTerm: string, page: number = 1, limit: number = 10) {
    try {
      const offset = (page - 1) * limit;
      
      const { data, error, count } = await supabaseAdmin
        .from('coupons')
        .select('*', { count: 'exact' })
        .or(`code.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .order('date_created', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return {
        coupons: data,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
        searchTerm
      };
    } catch (error) {
      console.error('Error searching coupons:', error);
      throw error;
    }
  }

  /**
   * Validar cupón usando función de Supabase
   */
  static async validateCoupon(couponCode: string, userId: number, cartTotal?: number) {
    try {
      const { data, error } = await supabaseAdmin
        .rpc('validate_coupon', {
          p_coupon_code: couponCode,
          p_user_id: userId,
          p_cart_total: cartTotal
        });

      if (error) {
        throw error;
      }

      return data[0]; // La función RPC devuelve un array con un objeto
    } catch (error) {
      console.error('Error validating coupon:', error);
      
      // Fallback: validación manual si la función RPC no está disponible
      return await this.validateCouponManual(couponCode, userId, cartTotal);
    }
  }

  /**
   * Validación manual de cupón (fallback)
   */
  private static async validateCouponManual(couponCode: string, userId: number, cartTotal?: number) {
    try {
      const coupon = await this.getCouponByCode(couponCode);
      
      if (!coupon) {
        return {
          is_valid: false,
          coupon_data: null,
          error_message: 'Cupón no encontrado'
        };
      }

      if (coupon.status !== 'publish') {
        return {
          is_valid: false,
          coupon_data: null,
          error_message: 'Cupón no disponible'
        };
      }

      // Verificar expiración
      if (coupon.date_expires && new Date(coupon.date_expires) < new Date()) {
        return {
          is_valid: false,
          coupon_data: null,
          error_message: 'Este cupón ha expirado'
        };
      }

      // Verificar monto mínimo
      if (coupon.minimum_amount && cartTotal && cartTotal < coupon.minimum_amount) {
        return {
          is_valid: false,
          coupon_data: null,
          error_message: `El monto mínimo para usar este cupón es $${coupon.minimum_amount}`
        };
      }

      // Verificar límite de uso total
      if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
        return {
          is_valid: false,
          coupon_data: null,
          error_message: 'Este cupón ha alcanzado su límite de uso'
        };
      }

      // Verificar límite de uso por usuario
      if (coupon.usage_limit_per_user) {
        const { count: userUsageCount } = await supabaseAdmin
          .from('coupon_usage')
          .select('*', { count: 'exact', head: true })
          .eq('coupon_id', coupon.id)
          .eq('user_id', userId);

        if (userUsageCount && userUsageCount >= coupon.usage_limit_per_user) {
          return {
            is_valid: false,
            coupon_data: null,
            error_message: 'Ya has utilizado este cupón anteriormente'
          };
        }
      }

      return {
        is_valid: true,
        coupon_data: {
          id: coupon.id,
          code: coupon.code,
          amount: coupon.amount,
          discount_type: coupon.discount_type,
          description: coupon.description,
          date_expires: coupon.date_expires,
          usage_limit_per_user: coupon.usage_limit_per_user,
          status: coupon.status,
          minimum_amount: coupon.minimum_amount,
          maximum_amount: coupon.maximum_amount
        },
        error_message: null
      };
    } catch (error) {
      console.error('Error in manual coupon validation:', error);
      return {
        is_valid: false,
        coupon_data: null,
        error_message: 'Error al validar el cupón'
      };
    }
  }

  /**
   * Aplicar cupón (registrar uso)
   */
  static async applyCoupon(couponCode: string, userId: number, discountAmount: number, orderId?: number) {
    try {
      const { data, error } = await supabaseAdmin
        .rpc('apply_coupon', {
          p_coupon_code: couponCode,
          p_user_id: userId,
          p_discount_amount: discountAmount,
          p_order_id: orderId
        });

      if (error) {
        throw error;
      }

      return data[0]; // La función RPC devuelve un array con un objeto
    } catch (error) {
      console.error('Error applying coupon:', error);
      
      // Fallback: aplicación manual
      return await this.applyCouponManual(couponCode, userId, discountAmount, orderId);
    }
  }

  /**
   * Aplicación manual de cupón (fallback)
   */
  private static async applyCouponManual(couponCode: string, userId: number, discountAmount: number, orderId?: number) {
    try {
      const coupon = await this.getCouponByCode(couponCode);
      
      if (!coupon) {
        return {
          success: false,
          message: 'Cupón no encontrado',
          usage_id: null
        };
      }

      // Registrar uso del cupón
      const { data: usageData, error: usageError } = await supabaseAdmin
        .from('coupon_usage')
        .insert([{
          coupon_id: coupon.id,
          user_id: userId,
          order_id: orderId,
          discount_amount: discountAmount
        }])
        .select()
        .single();

      if (usageError) {
        if (usageError.code === '23505') { // unique_violation
          return {
            success: false,
            message: 'Este cupón ya fue usado en esta orden',
            usage_id: null
          };
        }
        throw usageError;
      }

      // Actualizar contador de uso
      await supabaseAdmin
        .from('coupons')
        .update({
          usage_count: coupon.usage_count + 1,
          date_modified: new Date().toISOString()
        })
        .eq('id', coupon.id);

      return {
        success: true,
        message: 'Cupón aplicado correctamente',
        usage_id: usageData.id
      };
    } catch (error) {
      console.error('Error in manual coupon application:', error);
      return {
        success: false,
        message: 'Error al aplicar el cupón',
        usage_id: null
      };
    }
  }

  /**
   * Obtener historial de uso de cupones por usuario
   */
  static async getUserCouponHistory(userId: number) {
    try {
      const { data, error } = await supabaseAdmin
        .rpc('get_user_coupon_history', {
          p_user_id: userId
        });

      if (error) {
        // Fallback: consulta manual
        const { data: historyData, error: historyError } = await supabaseAdmin
          .from('coupon_usage')
          .select(`
            *,
            coupons (
              code,
              description,
              discount_type
            )
          `)
          .eq('user_id', userId)
          .order('used_at', { ascending: false });

        if (historyError) throw historyError;
        return historyData;
      }

      return data;
    } catch (error) {
      console.error('Error fetching user coupon history:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de cupones
   */
  static async getCouponStats() {
    try {
      // Total de cupones
      const { count: totalCoupons, error: totalError } = await supabaseAdmin
        .from('coupons')
        .select('*', { count: 'exact', head: true });

      if (totalError) throw totalError;

      // Cupones activos
      const { count: activeCoupons, error: activeError } = await supabaseAdmin
        .from('coupons')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'publish');

      if (activeError) throw activeError;

      // Cupones usados
      const { count: usedCoupons, error: usedError } = await supabaseAdmin
        .from('coupon_usage')
        .select('*', { count: 'exact', head: true });

      if (usedError) throw usedError;

      // Descuento total otorgado
      const { data: discountData, error: discountError } = await supabaseAdmin
        .from('coupon_usage')
        .select('discount_amount');

      if (discountError) throw discountError;

      const totalDiscount = discountData.reduce((sum, usage) => sum + usage.discount_amount, 0);

      // Cupones expirados
      const { count: expiredCoupons, error: expiredError } = await supabaseAdmin
        .from('coupons')
        .select('*', { count: 'exact', head: true })
        .lt('date_expires', new Date().toISOString());

      if (expiredError) throw expiredError;

      return {
        totalCoupons: totalCoupons || 0,
        activeCoupons: activeCoupons || 0,
        usedCoupons: usedCoupons || 0,
        expiredCoupons: expiredCoupons || 0,
        totalDiscount: totalDiscount.toFixed(2),
        usageRate: totalCoupons ? ((usedCoupons || 0) / totalCoupons * 100).toFixed(1) : '0'
      };
    } catch (error) {
      console.error('Error fetching coupon stats:', error);
      throw error;
    }
  }

  /**
   * Calcular descuento de cupón
   */
  static calculateDiscount(coupon: Coupon, cartTotal: number): number {
    let discount = 0;

    switch (coupon.discount_type) {
      case 'percent':
        discount = (cartTotal * coupon.amount) / 100;
        break;
      case 'fixed_cart':
        discount = coupon.amount;
        break;
      case 'fixed_product':
        discount = coupon.amount; // Se aplicaría por producto
        break;
    }

    // Aplicar límite máximo si existe
    if (coupon.maximum_amount && discount > coupon.maximum_amount) {
      discount = coupon.maximum_amount;
    }

    return Math.min(discount, cartTotal); // No puede ser mayor al total del carrito
  }
}
