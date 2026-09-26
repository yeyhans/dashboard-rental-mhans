import {
  PricingError,
  computeOrderTotals,
  type OrderTotals,
  type PricingCoupon,
  type PricingLineInput,
} from '../lib/pricing';
import { CouponService, couponCodeFromLines } from './couponService';

/** Who asked for the order: the customer frontend (API key) or an admin session. */
export type OrderCallerOrigin = 'frontend' | 'admin';

/** The money columns the server owns. `total` is the legacy WooCommerce mirror of the total. */
export interface PricedOrderFields {
  num_jornadas: number;
  shipping_total: number;
  calculated_subtotal: number;
  calculated_discount: number;
  calculated_iva: number;
  calculated_total: number;
  total: number;
}

type OrderRecord = Record<string, unknown>;

/** Fields whose presence in an update means the order's money has to be recomputed. */
const PRICING_KEYS = [
  'line_items',
  'order_fecha_inicio',
  'order_fecha_termino',
  'num_jornadas',
  'shipping_total',
  'calculated_subtotal',
  'calculated_discount',
  'calculated_iva',
  'calculated_total',
  'coupon_lines',
  'apply_iva',
] as const;

function parseLineItems(value: unknown): PricingLineInput[] {
  const parsed = typeof value === 'string' ? safeJson(value) : value;
  if (!Array.isArray(parsed)) {
    throw new PricingError('Los ítems de la orden no son válidos');
  }
  return parsed.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new PricingError(`El ítem ${index + 1} no es válido`);
    }
    const { price, quantity } = item as Record<string, unknown>;
    return { price: asNumeric(price), quantity: asNumeric(quantity) };
  });
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function asNumeric(value: unknown): number | string | null {
  return typeof value === 'number' || typeof value === 'string' ? value : null;
}

function asDate(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// The same reader the usage lifecycle uses. Two copies would be two answers to "which coupon is
// this order using?", and the one that recorded the use would be free to disagree with the one
// that priced it.
const couponCode = couponCodeFromLines;

function toFields(totals: OrderTotals): PricedOrderFields {
  return {
    num_jornadas: totals.jornadas,
    shipping_total: totals.shippingTotal,
    calculated_subtotal: totals.net,
    calculated_discount: totals.discount,
    calculated_iva: totals.iva,
    calculated_total: totals.total,
    total: totals.total,
  };
}

function storedNumber(value: unknown): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;
}

interface CouponContext {
  /** Products-only subtotal the coupon's `minimum_amount` is measured against. */
  readonly productsSubtotal: number;
  readonly customerId: number | null;
  readonly origin: OrderCallerOrigin;
  /** Only on an update; null when the order does not exist yet. */
  readonly orderId: number | null;
}

/** Products subtotal alone, used to judge the coupon before pricing the order with it. */
function productsSubtotalOf(input: {
  lineItems: PricingLineInput[];
  startDate: string | null;
  endDate: string | null;
  jornadas: number | string | null;
}): number {
  return computeOrderTotals({ ...input, applyIva: false }).productsSubtotal;
}

function asId(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isInteger(parsed) ? parsed : null;
}

export class OrderPricingService {
  /**
   * The coupon named in `coupon_lines`, only when the order may actually use it. The amount the
   * client wrote into the line is never used.
   *
   * Eligibility (estado, expiración, mínimo, límites de uso) is delegated to
   * `CouponService.couponEligibility`, the same check the checkout runs — validating it only in
   * the browser meant a direct POST with an expired or exhausted code still got its discount.
   *
   * Two outcomes on purpose:
   *  - `frontend` (customer, API key): a 400 in Spanish, so the checkout can tell the customer
   *    why the code did not apply instead of silently charging them the full price.
   *  - `admin`: the coupon is dropped to zero discount and logged. An admin edit must not fail
   *    because of a coupon line the order has been carrying for months.
   */
  private static async resolveCoupon(
    couponLines: unknown,
    context: CouponContext
  ): Promise<PricingCoupon | null> {
    const code = couponCode(couponLines);
    if (!code) return null;

    const coupon = await CouponService.getCouponByCode(code);
    const eligibility = coupon
      ? await CouponService.couponEligibility(coupon, context.customerId, context.productsSubtotal)
      : { eligible: false, reason: 'Cupón no encontrado' };

    if (!eligibility.eligible) {
      const reason = eligibility.reason ?? 'Cupón no válido';
      if (context.origin === 'frontend') {
        throw new PricingError(reason);
      }
      console.warn('[OrderPricingService] Cupón ignorado al calcular la orden:', {
        orderId: context.orderId,
        code,
        found: !!coupon,
        status: coupon?.status ?? null,
        reason,
      });
      return null;
    }

    return {
      discount_type: coupon!.discount_type,
      amount: coupon!.amount,
      maximum_amount: coupon!.maximum_amount,
    };
  }

  /**
   * Money for a new order. A frontend caller can only get a discount through a valid coupon; an
   * admin may also set a manual flat discount.
   */
  static async priceNewOrder(orderData: OrderRecord, origin: OrderCallerOrigin): Promise<PricedOrderFields> {
    const lineItems = parseLineItems(orderData.line_items);
    const timing = {
      lineItems,
      startDate: asDate(orderData.order_fecha_inicio),
      endDate: asDate(orderData.order_fecha_termino),
      jornadas: asNumeric(orderData.num_jornadas),
    };
    const coupon = await OrderPricingService.resolveCoupon(orderData.coupon_lines, {
      productsSubtotal: productsSubtotalOf(timing),
      customerId: asId(orderData.customer_id),
      origin,
      orderId: asId(orderData.id),
    });

    return toFields(
      computeOrderTotals({
        ...timing,
        shippingTotal: asNumeric(orderData.shipping_total),
        coupon,
        discount: origin === 'admin' ? asNumeric(orderData.calculated_discount) : null,
        applyIva: orderData.apply_iva !== false,
      })
    );
  }

  /**
   * Money for an admin edit: the stored order merged with the update. Returns null when the update
   * touches none of the pricing inputs, so status-only edits leave the stored figures alone.
   *
   * `apply_iva` has no column. Absent from the update, it is derived from the stored order: an
   * order that already had a taxable base but no IVA is exempt; one with nothing to tax yet is not.
   */
  static async priceOrderUpdate(current: OrderRecord, update: OrderRecord): Promise<PricedOrderFields | null> {
    if (!PRICING_KEYS.some(key => update[key] !== undefined)) return null;

    const pick = (key: string): unknown => (update[key] !== undefined ? update[key] : current[key]);

    const applyIva =
      typeof update.apply_iva === 'boolean'
        ? update.apply_iva
        : storedNumber(current.calculated_iva) > 0 || storedNumber(current.calculated_subtotal) <= 0;

    const lineItems = parseLineItems(pick('line_items') ?? []);
    const timing = {
      lineItems,
      startDate: asDate(pick('order_fecha_inicio')),
      endDate: asDate(pick('order_fecha_termino')),
      jornadas: asNumeric(pick('num_jornadas')),
    };
    // An admin edit never fails over its coupon: an ineligible one is dropped to zero and logged.
    const coupon = await OrderPricingService.resolveCoupon(pick('coupon_lines'), {
      productsSubtotal: productsSubtotalOf(timing),
      customerId: asId(current.customer_id),
      origin: 'admin',
      orderId: asId(current.id),
    });

    return toFields(
      computeOrderTotals({
        ...timing,
        shippingTotal: asNumeric(pick('shipping_total')),
        coupon,
        discount: asNumeric(pick('calculated_discount')),
        applyIva,
      })
    );
  }
}
