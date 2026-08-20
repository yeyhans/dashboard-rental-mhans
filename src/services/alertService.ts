import { supabaseAdmin } from '../lib/supabase';
import { activeStatusFilter } from '../lib/orderStatus';
import { buildAlerts, type Alert, type AlertOrderLike } from '../lib/alerts';

/**
 * The Torre de Control watchlist.
 *
 * Only orders still in flight are read: a completed rental cannot have its pickup blocked, and an
 * overdue balance already surfaces in Finanzas. The contract check joins `user_profiles` for
 * `url_user_contrato`, which is the field the business rule actually gates on.
 */
export class AlertService {
  private static ensureSupabaseAdmin() {
    if (!supabaseAdmin) throw new Error('Supabase admin client is not initialized');
  }

  static async getAlerts(now: Date = new Date()): Promise<Alert[]> {
    AlertService.ensureSupabaseAdmin();

    const { data, error } = await supabaseAdmin!
      .from('orders')
      .select(
        'id, order_key, status, calculated_total, pago_reserva, pago_completo, ' +
          'order_fecha_inicio, order_fecha_termino, ' +
          'billing_first_name, billing_last_name, billing_company, ' +
          'user_profiles (url_user_contrato)'
      )
      .in('status', activeStatusFilter())
      .limit(500);

    if (error) throw error;

    const orders: AlertOrderLike[] = (data ?? []).map((row: any) => {
      const company = row.billing_company?.trim();
      const person = `${row.billing_first_name ?? ''} ${row.billing_last_name ?? ''}`.trim();

      return {
        id: row.id,
        reference: row.order_key || `PED-${row.id}`,
        client: company || person || 'Sin cliente',
        status: row.status,
        total: Number(row.calculated_total) || 0,
        reservePaid: !!row.pago_reserva,
        fullyPaid: !!row.pago_completo,
        startDate: row.order_fecha_inicio,
        endDate: row.order_fecha_termino,
        hasContract: !!row.user_profiles?.url_user_contrato,
      };
    });

    return buildAlerts(orders, now);
  }

  /**
   * Count for the sidebar badge. Failures resolve to zero rather than throwing: a broken bell
   * must not take down every page that renders the shell.
   */
  static async getAlertCount(now: Date = new Date()): Promise<number> {
    try {
      return (await AlertService.getAlerts(now)).length;
    } catch (error) {
      console.error('[AlertService] No se pudo contar las alertas:', error);
      return 0;
    }
  }
}
