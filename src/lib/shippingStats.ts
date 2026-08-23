/**
 * Shipping method stats — the pure aggregation.
 *
 * Backs the indicator row of the Envíos module. Cancelled shipments are excluded everywhere, for
 * the same reason as in [[delivery]]: they never left, so folding them into volume or revenue
 * inflates figures the business uses to settle with the courier.
 */

import { isAwaitingDispatch } from './delivery';

export interface ShippingStatsInput {
  readonly status: string;
  readonly cost: number;
}

export interface MethodCounts {
  readonly totalMethods: number;
  readonly activeMethods: number;
}

export interface ShippingStats extends MethodCounts {
  totalShipments: number;
  pendingShipments: number;
  deliveredShipments: number;
  /** Fixed to two decimals; the view parses it back with `Number()`. */
  totalRevenue: string;
  /** Percentage of counted shipments already delivered, one decimal. */
  deliveryRate: string;
}

export function shippingStats(
  shipments: readonly ShippingStatsInput[],
  methods: MethodCounts
): ShippingStats {
  const counted = shipments.filter(s => s.status !== 'cancelled');

  const pendingShipments = counted.filter(s => isAwaitingDispatch(s.status)).length;
  const deliveredShipments = counted.filter(s => s.status === 'delivered').length;
  const revenue = counted.reduce((sum, s) => sum + (Number.isFinite(s.cost) ? s.cost : 0), 0);

  return {
    totalMethods: methods.totalMethods,
    activeMethods: methods.activeMethods,
    totalShipments: counted.length,
    pendingShipments,
    deliveredShipments,
    totalRevenue: revenue.toFixed(2),
    deliveryRate: counted.length > 0 ? ((deliveredShipments / counted.length) * 100).toFixed(1) : '0.0',
  };
}
