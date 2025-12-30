import type { LineItem } from '../core/types';

export interface PriceCalculation {
  subtotal: number;
  iva: number;
  total: number;
  reserve: number;
}

/**
 * Calculate order totals with IVA (19%)
 */
export function calculateOrderTotals(
  lineItems: LineItem[],
  numJornadas: number,
  discount: number = 0
): PriceCalculation {
  const subtotal = lineItems.reduce((sum, item) => {
    return sum + parseFloat(String(item.price)) * item.quantity * numJornadas;
  }, 0);

  const discountedSubtotal = subtotal - discount;
  const iva = discountedSubtotal * 0.19;
  const total = discountedSubtotal + iva;
  const reserve = total * 0.25;

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
  return calculateItemSubtotal(price, quantity, jornadas) * 0.19;
}

/**
 * Calculate total (with IVA) for a single item
 */
export function calculateItemTotal(
  price: number,
  quantity: number,
  jornadas: number
): number {
  return calculateItemSubtotal(price, quantity, jornadas) * 1.19;
}

/**
 * Calculate products-only totals (excluding shipping and discounts)
 */
export function calculateProductsOnlyTotals(
  lineItems: LineItem[],
  numJornadas: number
): PriceCalculation {
  const subtotal = lineItems.reduce((sum, item) => {
    return sum + item.price * item.quantity * numJornadas;
  }, 0);

  const iva = subtotal * 0.19;
  const total = subtotal * 1.19;
  const reserve = total * 0.25;

  return { subtotal, iva, total, reserve };
}
