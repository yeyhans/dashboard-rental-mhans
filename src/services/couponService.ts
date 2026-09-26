import { supabaseAdmin } from '../lib/supabase';
import type { Database } from '../types/database';
import { computeDiscount } from '../lib/pricing';
import { canonicalStatus } from '../lib/orderStatus';

type Coupon = Database['public']['Tables']['coupons']['Row'];
type CouponInsert = Database['public']['Tables']['coupons']['Insert'];
type CouponUpdate = Database['public']['Tables']['coupons']['Update'];
type CouponUsage = Database['public']['Tables']['coupon_usage']['Row'];

/**
 * The coupon code an order carries, or `null`.
 *
 * `orders.coupon_lines` is jsonb, but it reaches this code both as a parsed array (PostgREST) and
 * as a JSON string (a client that stringified it before sending). Only the first line counts:
 * `computeOrderTotals` applies one coupon, so a second line would be a discount nobody charged.
 */
export function couponCodeFromLines(couponLines: unknown): string | null {
  let lines = couponLines;
  if (typeof lines === 'string') {
    try {
      lines = JSON.parse(lines);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(lines) || lines.length === 0) return null;
  const first = lines[0] as Record<string, unknown> | null;
  const code = first && typeof first === 'object' ? first.code : null;
  return typeof code === 'string' && code.trim() ? code.trim() : null;
}

/** The persisted order columns the coupon usage lifecycle reads. */
export interface OrderCouponSnapshot {
  id: number | string | null;
  customer_id: number | string | null;
  coupon_lines: unknown;
  calculated_discount: number | string | null;
  status?: string | null;
}

function asInteger(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isInteger(parsed) ? parsed : null;
}

function asAmount(value: unknown): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;
}

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
   * ¿Puede esta orden usar este cupón? Única respuesta server-side de elegibilidad.
   *
   * Vive aquí, y no en `orderPricingService`, porque es lógica de negocio de cupones: el checkout
   * (`validateCouponManual`) y el cálculo de la orden deben responder exactamente lo mismo. Antes
   * sólo la validaba el checkout, así que un POST directo a `/api/orders` con un cupón vencido o
   * agotado igual se calculaba y se persistía con el descuento aplicado.
   *
   * `cartTotal` es el subtotal de PRODUCTOS (sin envío): el mínimo del cupón se compara contra lo
   * que el cupón puede descontar, no contra lo que la orden cobra.
   *
   * `userId` nulo (orden sin cliente todavía) omite el límite por usuario: no hay a quién contarle
   * los usos, e inventar un rechazo ahí bloquearía una orden legítima del panel.
   */
  static async couponEligibility(
    coupon: Coupon,
    userId: number | null,
    cartTotal?: number
  ): Promise<{ eligible: boolean; reason: string | null }> {
    const reject = (reason: string) => ({ eligible: false, reason });

    if (coupon.status !== 'publish') {
      return reject('Cupón no disponible');
    }

    if (coupon.date_expires && new Date(coupon.date_expires) < new Date()) {
      return reject('Este cupón ha expirado');
    }

    if (coupon.minimum_amount && cartTotal !== undefined && cartTotal < coupon.minimum_amount) {
      return reject(`El monto mínimo para usar este cupón es $${coupon.minimum_amount}`);
    }

    if (coupon.usage_limit && (coupon.usage_count ?? 0) >= coupon.usage_limit) {
      return reject('Este cupón ha alcanzado su límite de uso');
    }

    if (coupon.usage_limit_per_user && userId !== null) {
      const { count: userUsageCount } = await supabaseAdmin
        .from('coupon_usage')
        .select('*', { count: 'exact', head: true })
        .eq('coupon_id', coupon.id)
        .eq('user_id', userId);

      if (userUsageCount && userUsageCount >= coupon.usage_limit_per_user) {
        return reject('Ya has utilizado este cupón anteriormente');
      }
    }

    return { eligible: true, reason: null };
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

      // Estado, expiración, mínimo y límites de uso: una sola implementación compartida con el
      // cálculo de la orden (`orderPricingService`), para que ambos respondan lo mismo.
      const eligibility = await this.couponEligibility(coupon, userId, cartTotal);
      if (!eligibility.eligible) {
        return {
          is_valid: false,
          coupon_data: null,
          error_message: eligibility.reason
        };
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

  /* -------------------------------------------------------------------------------------------
   * Coupon usage lifecycle — record on create, release on cancellation
   *
   * `applyCoupon` above is reachable only from `POST /api/coupons/apply/[code]`, which nothing in
   * the order flow calls. So until these methods existed, a coupon attached to a real order never
   * produced a `coupon_usage` row and never incremented `usage_count` — and `couponEligibility`,
   * reading those untouched counters, concluded the coupon had never been used. `usage_limit` and
   * `usage_limit_per_user` were decorative: a single-use coupon could be spent forever.
   *
   * The work is done by two database functions (migration 0013) rather than here, because the
   * limit has to be judged under a row lock on the coupon. Two orders created in the same instant
   * both read `usage_count = 0` from the application, and both slip past a one-use limit; inside
   * `record_coupon_usage_for_order` the second one waits for the first and is refused.
   *
   * Nothing here ever throws. By the time these run the order row exists, and an order is revenue
   * while a missing usage row is a reconciliation chore. Failures are logged with the order id
   * and the code so they can be replayed by hand.
   * ---------------------------------------------------------------------------------------- */

  /**
   * Makes `coupon_usage` match the order as stored.
   *
   * `isNew` marks the call that follows an insert: nothing can be recorded for an order that did
   * not exist a moment ago, so an order with no coupon (the common case) skips the database
   * entirely instead of paying for a release that would delete nothing.
   *
   * A cancelled order releases. So does an order whose coupon was removed by an edit, or one with
   * no customer to charge the use to. Anything else records — and recording the same
   * (order, coupon, customer) twice is a no-op on the database side, so a re-save is harmless.
   */
  static async syncOrderCouponUsage(
    order: OrderCouponSnapshot,
    options: { isNew?: boolean } = {}
  ): Promise<void> {
    const orderId = asInteger(order?.id);
    if (orderId === null || orderId <= 0) return;

    const code = couponCodeFromLines(order.coupon_lines);
    const userId = asInteger(order.customer_id);
    const cancelled = canonicalStatus(order.status) === 'cancelled';

    if (cancelled || !code || userId === null) {
      // On a fresh insert there is nothing to release yet.
      if (options.isNew) return;
      await CouponService.releaseOrderCouponUsage(orderId);
      return;
    }

    await CouponService.recordOrderCouponUsage(
      orderId,
      code,
      userId,
      asAmount(order.calculated_discount)
    );
  }

  /**
   * Records the use of `code` by `orderId`, under the coupon's row lock. Logs and returns on any
   * refusal — an exhausted limit, a missing coupon, a dead connection — and never throws.
   */
  static async recordOrderCouponUsage(
    orderId: number,
    code: string,
    userId: number,
    discountAmount: number
  ): Promise<void> {
    if (!supabaseAdmin) {
      console.error('[CouponService] No se pudo registrar el uso del cupón:', {
        orderId,
        code,
        userId,
        error: 'Supabase admin client not initialized',
      });
      return;
    }

    try {
      const { data, error } = await supabaseAdmin.rpc('record_coupon_usage_for_order', {
        p_order_id: orderId,
        p_coupon_code: code,
        p_user_id: userId,
        p_discount_amount: discountAmount,
      });

      if (error) {
        console.error('[CouponService] No se pudo registrar el uso del cupón:', {
          orderId,
          code,
          userId,
          error,
        });
        return;
      }

      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.success) {
        // Not an error of ours: the coupon is spent, or the customer already used it. The order
        // keeps the discount it was priced with; the discrepancy is visible in this log.
        console.error('[CouponService] Uso de cupón rechazado por la base de datos:', {
          orderId,
          code,
          userId,
          message: result?.message ?? null,
        });
      }
    } catch (error) {
      console.error('[CouponService] No se pudo registrar el uso del cupón:', {
        orderId,
        code,
        userId,
        error,
      });
    }
  }

  /**
   * Releases whatever usage the order had recorded: deletes its `coupon_usage` rows and gives the
   * counter back. Idempotent — a second cancellation, or an order that never had a coupon, finds
   * nothing to delete and reports zero. Never throws.
   */
  static async releaseOrderCouponUsage(orderId: number): Promise<void> {
    const id = asInteger(orderId);
    if (id === null || id <= 0) return;

    if (!supabaseAdmin) {
      console.error('[CouponService] No se pudo liberar el uso del cupón:', {
        orderId: id,
        error: 'Supabase admin client not initialized',
      });
      return;
    }

    try {
      const { error } = await supabaseAdmin.rpc('release_coupon_usage_for_order', {
        p_order_id: id,
      });

      if (error) {
        console.error('[CouponService] No se pudo liberar el uso del cupón:', { orderId: id, error });
      }
    } catch (error) {
      console.error('[CouponService] No se pudo liberar el uso del cupón:', { orderId: id, error });
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
    // Single source of truth for coupon math: src/lib/pricing.ts.
    return computeDiscount(coupon, cartTotal);
  }
}
