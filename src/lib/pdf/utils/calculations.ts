import type { LineItem } from '../core/types';

export const IVA_RATE = 0.19;
export const RESERVE_RATE = 0.25;

export interface PriceCalculation {
  subtotal: number;
  iva: number;
  total: number;
  reserve: number;
}

/**
 * Calculate order totals with IVA (19%)
 * Base imponible = subtotal - discount + shippingTotal (shipping es afecto a IVA)
 */
export function calculateOrderTotals(
  lineItems: LineItem[],
  numJornadas: number,
  discount: number = 0,
  shippingTotal: number = 0
): PriceCalculation {
  const subtotal = lineItems.reduce((sum, item) => {
    return sum + parseFloat(String(item.price)) * item.quantity * numJornadas;
  }, 0);

  const baseImponible = subtotal - discount + shippingTotal;
  const iva = baseImponible * IVA_RATE;
  const total = baseImponible + iva;
  const reserve = total * RESERVE_RATE;

  return { subtotal, iva, total, reserve };
}

/**
 * Calculate subtotal for a single item
 */
export function calculateItemSubtotal(
  price: number,
  quantity: number,
  jornadas: number
): number {
  return price * quantity * jornadas;
}

/**
 * Calculate IVA (19%) for a single item
 */
export function calculateItemIVA(
  price: number,
  quantity: number,
  jornadas: number
): number {
  return calculateItemSubtotal(price, quantity, jornadas) * IVA_RATE;
}

/**
 * Calculate total (with IVA) for a single item
 */
export function calculateItemTotal(
  price: number,
  quantity: number,
  jornadas: number
): number {
  return calculateItemSubtotal(price, quantity, jornadas) * (1 + IVA_RATE);
}

/**
 * Calculate products-only totals (excluding shipping and discounts).
 * Used for per-item breakdown in documents.
 */
export function calculateProductsOnlyTotals(
  lineItems: LineItem[],
  numJornadas: number
): PriceCalculation {
  const subtotal = lineItems.reduce((sum, item) => {
    return sum + item.price * item.quantity * numJornadas;
  }, 0);

  const iva = subtotal * IVA_RATE;
  const total = subtotal * (1 + IVA_RATE);
  const reserve = total * RESERVE_RATE;

  return { subtotal, iva, total, reserve };
}
