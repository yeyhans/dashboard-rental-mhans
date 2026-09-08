import { supabaseAdmin } from '../lib/supabase';
import { activeStatusFilter } from '../lib/orderStatus';
import {
  catalogKpis,
  occupancyOn,
  type CatalogKpis,
  type CatalogProductLike,
  type RentalWindowLike,
} from '../lib/catalogAvailability';
import type { LineItem } from '../types/order';

/**
 * Live availability for the Catálogo de Equipos indicator row.
 *
 * Occupancy is computed by crossing today's active rentals against the catalogue — the schema has
 * no serialised inventory, so this is the only place the answer exists. See
 * `lib/catalogAvailability.ts` for what that does and does not allow us to claim.
 */
export class CatalogService {
  private static ensureSupabaseAdmin() {
    if (!supabaseAdmin) throw new Error('Supabase admin client is not initialized');
  }

  static async getAvailabilityKpis(now: Date = new Date()): Promise<CatalogKpis> {
    CatalogService.ensureSupabaseAdmin();

    const today = now.toISOString().slice(0, 10);

    const [{ data: products, error: productsError }, { data: orders, error: ordersError }] =
      await Promise.all([
        supabaseAdmin!.from('products').select('id, status, stock_status').limit(2000),
        supabaseAdmin!
          .from('orders')
          .select('status, order_fecha_inicio, order_fecha_termino, line_items')
          .in('status', activeStatusFilter())
          // Solo lo que puede estar cubriendo hoy: empezó en o antes de hoy y termina hoy o después.
          .lte('order_fecha_inicio', today)
          .gte('order_fecha_termino', today)
          .limit(500),
      ]);

    if (productsError) throw productsError;
    if (ordersError) throw ordersError;

    const rentals: RentalWindowLike[] = (orders ?? []).map((row: any) => ({
      status: row.status,
      startDate: row.order_fecha_inicio,
      endDate: row.order_fecha_termino,
      lineItems: Array.isArray(row.line_items) ? (row.line_items as LineItem[]) : [],
    }));

    const catalogue: CatalogProductLike[] = (products ?? []).map((row: any) => ({
      id: row.id,
      status: row.status,
      stockStatus: row.stock_status ?? 'instock',
    }));

    return catalogKpis(catalogue, occupancyOn(rentals, now));
  }
}
