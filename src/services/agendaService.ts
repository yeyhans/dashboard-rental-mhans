import { supabaseAdmin } from '../lib/supabase';
import { activeStatusFilter } from '../lib/orderStatus';
import { buildAgenda, type AgendaDay, type AgendaOrderLike } from '../lib/agenda';

/**
 * The five-day Agenda Operacional.
 *
 * Reads a slightly wider date window than the board itself: a rental starting tomorrow has its
 * PREPARATION today, so filtering strictly on the visible five days would drop the very row the
 * warehouse acts on first.
 */
export class AgendaService {
  private static ensureSupabaseAdmin() {
    if (!supabaseAdmin) throw new Error('Supabase admin client is not initialized');
  }

  static async getAgenda(now: Date = new Date(), days = 5): Promise<AgendaDay[]> {
    AgendaService.ensureSupabaseAdmin();

    const from = new Date(now.getTime() - 2 * 86_400_000).toISOString().slice(0, 10);
    const to = new Date(now.getTime() + (days + 2) * 86_400_000).toISOString().slice(0, 10);

    const { data, error } = await supabaseAdmin!
      .from('orders')
      .select(
        'id, order_key, status, order_proyecto, order_fecha_inicio, order_fecha_termino, ' +
          'billing_first_name, billing_last_name, billing_company'
      )
      .in('status', activeStatusFilter())
      // Una orden entra si su inicio O su término cae en la ventana ampliada.
      .or(`and(order_fecha_inicio.gte.${from},order_fecha_inicio.lte.${to}),and(order_fecha_termino.gte.${from},order_fecha_termino.lte.${to})`)
      .limit(300);

    if (error) throw error;

    const orders: AgendaOrderLike[] = (data ?? []).map((row: any) => {
      const company = row.billing_company?.trim();
      const person = `${row.billing_first_name ?? ''} ${row.billing_last_name ?? ''}`.trim();

      return {
        id: row.id,
        reference: row.order_key || `PED-${row.id}`,
        client: company || person || 'Sin cliente',
        project: row.order_proyecto || 'Sin proyecto',
        status: row.status,
        startDate: row.order_fecha_inicio,
        endDate: row.order_fecha_termino,
      };
    });

    return buildAgenda(orders, now, days);
  }
}
