import {
  buildBodegaBoard,
  clientName,
  isoDay,
  orderReference,
  projectLabel,
  scanSheetLines,
  type BodegaBoard,
  type BodegaMovementLike,
  type BodegaOrderLike,
} from '../lib/bodega';
import type { ScanLine } from '../lib/bodegaScan';
import { supabaseAdmin } from '../lib/supabase';

/**
 * Bodega — data for the garage worker's screens (batch 3).
 *
 * Reads only: the worker's writes go through `POST /api/inventory/movements`, the same endpoint
 * Delivery and Check-In use, so the transition rules and the `checked_by_admin_id` signature are
 * not duplicated here. All derivations are in `lib/bodega.ts` and tested there; this class
 * fetches rows and hands them over.
 *
 * "Currently out" is answered by the `asset_current_state` view (0012): one row per unit, its
 * latest movement, resolved in the database — never by a bounded window of rows (R3-101).
 */
const ORDER_COLUMNS =
  'id, order_key, order_proyecto, order_fecha_inicio, order_fecha_termino, ' +
  'billing_first_name, billing_last_name, billing_company, line_items';

const MOVEMENT_COLUMNS = 'asset_id, order_id, direction, checked_at';

export interface ScanSheetOrder {
  id: number;
  reference: string;
  client: string;
  project: string;
  startDate: string | null;
  endDate: string | null;
}

export interface ScanSheet {
  order: ScanSheetOrder;
  lines: ScanLine[];
}

export class BodegaService {
  /** `as any`: `asset_movements`/`serialised_assets` are not in the generated `Database` type yet. */
  private static ensureSupabaseAdmin() {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available');
    }
    return supabaseAdmin as any;
  }

  /** Every unit whose latest movement is a checkout — i.e. everything out right now. */
  private static async openCheckouts(client: any): Promise<BodegaMovementLike[]> {
    const { data, error } = await client
      .from('asset_current_state')
      .select(MOVEMENT_COLUMNS)
      .eq('direction', 'checkout');
    if (error) {
      console.error('[BodegaService] Error al cargar el estado actual de las unidades:', { error });
      throw error;
    }
    return (data as BodegaMovementLike[]) || [];
  }

  /** `now` is injected so the board is deterministic and testable. */
  static async getBoard(now: Date = new Date()): Promise<BodegaBoard> {
    const client = this.ensureSupabaseAdmin();

    const [{ data: usage, error: usageError }, movements] = await Promise.all([
      client
        .from('shipping_usage')
        .select(`id, order_id, status, orders (${ORDER_COLUMNS})`)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(200),
      this.openCheckouts(client),
    ]);

    if (usageError) {
      console.error('[BodegaService] Error al cargar los retiros pendientes:', { error: usageError });
      throw usageError;
    }

    const shipments = ((usage as any[]) || []).map((row) => ({
      status: String(row.status ?? ''),
      order: (row.orders as BodegaOrderLike | null) ?? null,
    }));

    // Orders with something out — only those can be returns. Fetched by id, so a closed order
    // with a unit still out (the case that matters most) is on the board regardless of status.
    const orderIds = [...new Set(movements.map((m) => m.order_id))];
    let orders: BodegaOrderLike[] = [];
    if (orderIds.length > 0) {
      const { data, error } = await client.from('orders').select(ORDER_COLUMNS).in('id', orderIds);
      if (error) {
        console.error('[BodegaService] Error al cargar las órdenes con equipos afuera:', { error });
        throw error;
      }
      orders = (data as BodegaOrderLike[]) || [];
    }

    return buildBodegaBoard({ shipments, orders, movements, now });
  }

  /** The order as the worker scans it: header plus one line per product. `null` if it does not exist. */
  static async getScanSheet(orderId: number): Promise<ScanSheet | null> {
    const client = this.ensureSupabaseAdmin();

    const { data: order, error: orderError } = await client
      .from('orders')
      .select(ORDER_COLUMNS)
      .eq('id', orderId)
      .maybeSingle();
    if (orderError) {
      console.error('[BodegaService] Error al cargar la orden:', { orderId, error: orderError });
      throw orderError;
    }
    if (!order) return null;

    const { data: movementRows, error: movementsError } = await client
      .from('asset_movements')
      .select(MOVEMENT_COLUMNS)
      .eq('order_id', orderId)
      .order('checked_at', { ascending: false });
    if (movementsError) {
      console.error('[BodegaService] Error al cargar los movimientos de la orden:', { orderId, error: movementsError });
      throw movementsError;
    }
    const movements = (movementRows as BodegaMovementLike[]) || [];

    const assetProducts = new Map<number, number>();
    const assetIds = [...new Set(movements.map((m) => m.asset_id))];
    if (assetIds.length > 0) {
      const { data: assets, error: assetsError } = await client
        .from('serialised_assets')
        .select('id, product_id')
        .in('id', assetIds);
      if (assetsError) {
        console.error('[BodegaService] Error al cargar las unidades de la orden:', { orderId, error: assetsError });
        throw assetsError;
      }
      for (const asset of (assets as Array<{ id: number; product_id: number }>) || []) {
        assetProducts.set(asset.id, asset.product_id);
      }
    }

    const typedOrder = order as BodegaOrderLike;
    return {
      order: {
        id: typedOrder.id,
        reference: orderReference(typedOrder),
        client: clientName(typedOrder),
        project: projectLabel(typedOrder),
        startDate: typedOrder.order_fecha_inicio ? isoDay(typedOrder.order_fecha_inicio) : null,
        endDate: typedOrder.order_fecha_termino ? isoDay(typedOrder.order_fecha_termino) : null,
      },
      lines: scanSheetLines(typedOrder.line_items, movements, assetProducts),
    };
  }
}

export default BodegaService;
