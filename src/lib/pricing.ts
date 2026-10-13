/**
 * Order pricing — the single money formula.
 *
 * Pure and framework-free on purpose: the same rules are mirrored by the customer frontend and by
 * Hermes (Python), and all three are held to `__fixtures__/pricing-golden.json`. Change a rule
 * here only together with that file.
 *
 * Rules (CLP integers, half-up rounding):
 *  1. line subtotal = round(unit daily price x quantity x jornadas)
 *  2. jornadas = inclusive calendar days, computed in UTC from the Y-M-D parts
 *  3. products subtotal = sum of line subtotals
 *  4. discount applies to products only, clamped to [0, products subtotal]. Precedence: coupon,
 *     then a manual percentage (R-05, same base and rounding as a percent coupon), then a manual
 *     flat amount
 *  5. net (`calculated_subtotal`) = products subtotal - discount + shipping (shipping is taxed)
 *  6. iva = round(net x 19%) when IVA applies; total = net + iva
 *  7. reserve = `finance.reserveAmount`; balance = total - reserve
 */

import { DEFAULT_RESERVE_VALUE, reserveAmount } from './finance';

export const IVA_RATE = 0.19;
export const BALANCE_LABEL = 'Saldo';

const MS_PER_DAY = 86_400_000;

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PricingError';
  }
}

type NumericLike = number | string | null | undefined;

export interface PricingLineInput {
  readonly price: NumericLike;
  readonly quantity: NumericLike;
}

export interface PricingCoupon {
  readonly discount_type: string;
  readonly amount: NumericLike;
  readonly maximum_amount?: NumericLike;
}

export interface OrderTotalsInput {
  readonly lineItems: readonly PricingLineInput[];
  /** 'YYYY-MM-DD'. When both dates are present they define the day count. */
  readonly startDate?: string | null | undefined;
  readonly endDate?: string | null | undefined;
  /** Used only when the dates are absent. */
  readonly jornadas?: NumericLike | undefined;
  readonly shippingTotal?: NumericLike | undefined;
  /** Takes precedence over `discount`. */
  readonly coupon?: PricingCoupon | null | undefined;
  /** Manual flat discount, used when there is no coupon and no `discountPercent`. */
  readonly discount?: NumericLike | undefined;
  /**
   * R-05: manual percentage (0, 100] over the products subtotal, used when there is no coupon.
   * Wins over `discount`. Validate with `parseDiscountPercent` before calling.
   */
  readonly discountPercent?: NumericLike | null | undefined;
  /** Defaults to true. */
  readonly applyIva?: boolean | undefined;
  readonly reserveType?: string | null | undefined;
  readonly reserveValue?: NumericLike | undefined;
}

export interface PricedLine {
  readonly price: number;
  readonly quantity: number;
  readonly subtotal: number;
}

export interface OrderTotals {
  readonly jornadas: number;
  readonly lines: readonly PricedLine[];
  readonly productsSubtotal: number;
  readonly discount: number;
  readonly shippingTotal: number;
  readonly net: number;
  readonly iva: number;
  readonly total: number;
  readonly reserve: number;
  readonly balance: number;
  readonly reserveLabel: string;
}

/**
 * Half-up for the non-negative amounts this module handles.
 *
 * Exported so the client-facing documents round exactly as the charged total does: a PDF that
 * rounded its own way disagreed with the footer by ±1 CLP. See `orderBreakdown.ts`.
 */
export function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

/**
 * IVA over a net amount, half-up. Integer arithmetic keeps x.5 exact —
 * `floor((net * 19 + 50) / 100)` instead of `round(net * 0.19)`, which drifts on binary halves.
 */
export function ivaAmount(net: number): number {
  return Math.floor((net * 19 + 50) / 100);
}

function toNumber(value: NumericLike): number {
  if (value === null || value === undefined || value === '') return NaN;
  return typeof value === 'string' ? Number(value) : value;
}

function toNonNegative(value: NumericLike, field: string): number {
  const parsed = toNumber(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new PricingError(`Valor inválido para ${field}`);
  }
  return parsed;
}

function optionalNonNegative(value: NumericLike, field: string): number {
  if (value === null || value === undefined || value === '') return 0;
  return toNonNegative(value, field);
}

const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

function utcDay(value: string, field: string): number {
  const match = DATE_PREFIX.exec(value);
  if (!match) throw new PricingError(`Fecha inválida en ${field}`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const time = Date.UTC(year, month - 1, day);
  const check = new Date(time);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new PricingError(`Fecha inválida en ${field}`);
  }
  return time;
}

/** Inclusive calendar days between two date-only strings; immune to the process time zone. */
export function countJornadas(startDate: string, endDate: string): number {
  const start = utcDay(startDate, 'fecha de inicio');
  const end = utcDay(endDate, 'fecha de término');
  if (end < start) {
    throw new PricingError('La fecha de término no puede ser anterior a la de inicio');
  }
  return Math.round((end - start) / MS_PER_DAY) + 1;
}

/** Coupon discount over the products subtotal, clamped to [0, productsSubtotal]. */
export function computeDiscount(coupon: PricingCoupon | null | undefined, productsSubtotal: number): number {
  if (!coupon) return 0;
  const amount = toNumber(coupon.amount);
  if (!Number.isFinite(amount)) return 0;

  let discount: number;
  switch (coupon.discount_type) {
    case 'percent': {
      discount = roundHalfUp((productsSubtotal * amount) / 100);
      const maximum = toNumber(coupon.maximum_amount ?? null);
      if (Number.isFinite(maximum) && maximum > 0) discount = Math.min(discount, maximum);
      break;
    }
    case 'fixed_cart':
      discount = amount;
      break;
    case 'fixed_product':
      // TODO(business): WooCommerce applies fixed_product per unit of each eligible product. The
      // dashboard has always applied it as a flat amount; kept until the business defines it.
      discount = amount;
      break;
    default:
      discount = 0;
  }

  return clampDiscount(discount, productsSubtotal);
}

/** Same arithmetic as a percent coupon: products x % / 100, half-up, clamped. */
function percentDiscount(productsSubtotal: number, percent: number): number {
  return clampDiscount(roundHalfUp((productsSubtotal * percent) / 100), productsSubtotal);
}

/**
 * R-05: server-side reading of `orders.discount_percent`. Empty means "no percentage"; anything
 * else must be a number in (0, 100] with at most two decimals (the column is numeric(5,2)).
 */
/** The one range rule for a manual percentage: (0, 100]. */
function isPercentInRange(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 100;
}

export function parseDiscountPercent(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = toNumber(value as NumericLike);
  if (
    !isPercentInRange(parsed) ||
    Math.abs(Math.round(parsed * 100) - parsed * 100) > 1e-9
  ) {
    throw new PricingError('El descuento porcentual debe ser mayor que 0 y como máximo 100, con hasta dos decimales');
  }
  return parsed;
}

/** The order form's "Descuento" control: a mode and the raw text the admin typed. */
export type ManualDiscountMode = 'percent' | 'fixed';
export interface ManualDiscountInput {
  readonly mode: ManualDiscountMode;
  readonly value: string;
}

/** Control -> pricing inputs. An empty or invalid value means no manual discount of that kind. */
export function manualDiscountPricing(input: ManualDiscountInput): {
  discount: number | null;
  discountPercent: number | null;
} {
  const value = toNumber(input.value === '' ? null : input.value);
  if (!Number.isFinite(value) || value <= 0) return { discount: null, discountPercent: null };
  if (input.mode === 'percent') {
    return { discount: null, discountPercent: isPercentInRange(value) ? value : null };
  }
  return { discount: value, discountPercent: null };
}

/** The CLP amount the control would discount, for the preview next to it. */
export function manualDiscountAmount(input: ManualDiscountInput, productsSubtotal: number): number {
  const { discount, discountPercent } = manualDiscountPricing(input);
  if (discountPercent !== null) return percentDiscount(productsSubtotal, discountPercent);
  return discount !== null ? clampDiscount(discount, productsSubtotal) : 0;
}

/**
 * H-3: the edit form's `discount_percent` field. Left out (`undefined`) unless the admin touched
 * the discount control, so an ordinary save does not write a column that may not exist yet
 * (migration 0019) or clear a percentage it never showed; left out while a coupon applies.
 */
export function discountPercentPayload(
  input: ManualDiscountInput,
  state: { touched: boolean; couponApplied: boolean },
): number | null | undefined {
  if (!state.touched || state.couponApplied) return undefined;
  return manualDiscountPricing(input).discountPercent;
}

/** Initial control state from the stored order: its percentage, else its flat amount. */
export function initialManualDiscount(storedPercent: unknown, storedAmount: number): ManualDiscountInput {
  const percent = toNumber((storedPercent ?? null) as NumericLike);
  if (Number.isFinite(percent) && percent > 0) return { mode: 'percent', value: String(percent) };
  return { mode: 'fixed', value: storedAmount > 0 ? String(storedAmount) : '' };
}

function clampDiscount(discount: number, productsSubtotal: number): number {
  return Math.min(productsSubtotal, Math.max(0, roundHalfUp(discount)));
}

/** "Reserva 30%" for a percentage, "Reserva" for a fixed amount. */
export function reserveLabel(reserveType: string | null | undefined, reserveValue: NumericLike): string {
  if (reserveType === 'fixed') return 'Reserva';
  const parsed = toNumber(reserveValue);
  const value = Number.isFinite(parsed) ? parsed : DEFAULT_RESERVE_VALUE;
  return `Reserva ${String(value).replace('.', ',')}%`;
}

function resolveJornadas(input: OrderTotalsInput): number {
  if (input.startDate && input.endDate) return countJornadas(input.startDate, input.endDate);
  const explicit = toNumber(input.jornadas);
  if (!Number.isInteger(explicit) || explicit < 1) {
    throw new PricingError('Número de jornadas inválido');
  }
  return explicit;
}

export function computeOrderTotals(input: OrderTotalsInput): OrderTotals {
  const jornadas = resolveJornadas(input);

  const lines: PricedLine[] = input.lineItems.map((item, index) => {
    const price = toNonNegative(item.price, `precio del ítem ${index + 1}`);
    const quantity = toNonNegative(item.quantity, `cantidad del ítem ${index + 1}`);
    return { price, quantity, subtotal: roundHalfUp(price * quantity * jornadas) };
  });

  const productsSubtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const shippingTotal = roundHalfUp(optionalNonNegative(input.shippingTotal, 'envío'));

  let discount = 0;
  const percent = toNumber(input.discountPercent ?? null);
  if (input.coupon) {
    discount = computeDiscount(input.coupon, productsSubtotal);
  } else if (isPercentInRange(percent)) {
    discount = percentDiscount(productsSubtotal, percent);
  } else {
    const manual = toNumber(input.discount);
    discount = Number.isFinite(manual) ? clampDiscount(manual, productsSubtotal) : 0;
  }

  const net = productsSubtotal - discount + shippingTotal;
  const iva = input.applyIva === false ? 0 : ivaAmount(net);
  const total = net + iva;

  const reserve = reserveAmount({
    total,
    reserveType: input.reserveType ?? null,
    reserveValue: input.reserveValue ?? null,
  });

  return {
    jornadas,
    lines,
    productsSubtotal,
    discount,
    shippingTotal,
    net,
    iva,
    total,
    reserve,
    balance: total - reserve,
    reserveLabel: reserveLabel(input.reserveType, input.reserveValue),
  };
}
