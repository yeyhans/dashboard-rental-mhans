import { supabaseAdmin } from '../lib/supabase';
import {
  deliveryKpis,
  historyTotals,
  isAwaitingDispatch,
  type DeliveryKpis,
  type HistoryTotals,
} from '../lib/delivery';
import { shippingMethodFromRecord, type StoredShippingMethod } from '../lib/shippingMethods';
import type { LineItem } from '../types/order';

export interface ShipmentRow {
  id: number;
  orderId: number;
  orderReference: string;
  client: string;
  project: string;
  /** `null` si el método fue eliminado; el filtro por tipo se apoya en este id, no en el nombre. */
  methodId: number | null;
  methodName: string;
  cost: number;
  status: string;
  trackingNumber: string | null;
  createdAt: string | null;
  deliveredAt: string | null;
  /**
   * T-026 gap 2/4 (checkout registration). Solo se usa en `active` para ofrecer el control de
   * "Registrar salida" por equipo serializado — mismo insumo que `CheckInService` ya expone para
   * el check-in, vía `itemsFromLineItems`. `history` no necesita esto en el cliente, pero traerlo
   * aquí es gratis (mismo `orders` join) y evita una segunda query por fila.
   */
  lineItems: LineItem[];
}

/**
 * Un método de envío tal como lo edita el admin. Trae todas las columnas del formulario y no solo
 * las visibles en la tabla: abrir "Editar" con la mitad de los campos en blanco los guardaría
 * borrados, así que el board carga el registro completo de entrada.
 */
export type ShippingTypeRow = StoredShippingMethod;

export interface DeliveryBoard {
  kpis: DeliveryKpis;
  totals: HistoryTotals;
  /** Not yet delivered: the canonical's "Delivery activos hoy" table. */
  active: ShipmentRow[];
  history: ShipmentRow[];
  types: ShippingTypeRow[];
}

/**
 * Data for the Delivery module.
 *
 * `shipping_usage` is UNIQUE on `order_id`, so one order carries at most one shipment; the join
 * to `orders` is therefore one-to-one and safe to read in a single query.
 */
export class DeliveryService {
  private static ensureSupabaseAdmin() {
    if (!supabaseAdmin) throw new Error('Supabase admin client is not initialized');
  }

  static async getBoard(now: Date = new Date(), historyLimit = 200): Promise<DeliveryBoard> {
    DeliveryService.ensureSupabaseAdmin();

    const db = supabaseAdmin!;

    const [{ data: usage, error: usageError }, { data: methods, error: methodsError }] = await Promise.all([
      db
        .from('shipping_usage')
        .select(
          'id, order_id, shipping_method_id, shipping_cost, status, tracking_number, created_at, delivered_at, ' +
            'shipping_methods (name), ' +
            'orders (order_key, order_proyecto, billing_first_name, billing_last_name, billing_company, line_items)'
        )
        .order('created_at', { ascending: false })
        .limit(historyLimit),
      supabaseAdmin!
        .from('shipping_methods')
        .select(
          'id, name, description, cost, enabled, shipping_type, min_amount, max_amount, ' +
            'estimated_days_min, estimated_days_max, requires_address, requires_phone'
        )
        .order('name', { ascending: true }),
    ]);

    if (usageError) throw usageError;
    if (methodsError) throw methodsError;

    const rows: ShipmentRow[] = (usage ?? []).map((row: any) => {
      const order = row.orders ?? {};
      const company = order.billing_company?.trim();
      const person = `${order.billing_first_name ?? ''} ${order.billing_last_name ?? ''}`.trim();

      return {
        id: row.id,
        orderId: row.order_id,
        orderReference: order.order_key || `PED-${row.order_id}`,
        client: company || person || 'Sin cliente',
        project: order.order_proyecto || 'Sin proyecto',
        methodId: row.shipping_method_id ?? null,
        methodName: row.shipping_methods?.name || 'Sin método',
        cost: Number(row.shipping_cost) || 0,
        status: row.status || 'pending',
        trackingNumber: row.tracking_number,
        createdAt: row.created_at,
        deliveredAt: row.delivered_at,
        lineItems: Array.isArray(order.line_items) ? (order.line_items as LineItem[]) : [],
      };
    });

    const shipments = rows.map(r => ({
      status: r.status,
      cost: r.cost,
      createdAt: r.createdAt,
      deliveredAt: r.deliveredAt,
    }));

    return {
      kpis: deliveryKpis(shipments, now),
      totals: historyTotals(shipments),
      // Activos: todo lo que aún no se entregó ni se canceló, no solo lo creado hoy. Un envío
      // atascado desde ayer es justamente el que hay que ver.
      active: rows.filter(r => isAwaitingDispatch(r.status) || r.status === 'shipped'),
      history: rows,
      types: (methods ?? []).map(shippingMethodFromRecord),
    };
  }
}
