import { supabaseAdmin } from '../lib/supabase';
import { bookingStatusFilter } from '../lib/orderStatus';
import { isOverdue, outstandingAmount } from '../lib/finance';
import { clientKpis, type ClientKpis, type ClientProfileLike } from '../lib/clientStatus';

/**
 * The Clientes & Documentos indicator row.
 *
 * Two axes, computed separately because they are independent: how complete the client's paperwork
 * is, and whether they owe money. A validated client can still be a debtor, and treating the two
 * as one scale would hide whichever problem came second.
 */
export class ClientStatusService {
  private static ensureSupabaseAdmin() {
    if (!supabaseAdmin) throw new Error('Supabase admin client is not initialized');
  }

  static async getKpis(now: Date = new Date()): Promise<ClientKpis> {
    ClientStatusService.ensureSupabaseAdmin();

    const [{ data: profiles, error: profilesError }, { data: orders, error: ordersError }] =
      await Promise.all([
        supabaseAdmin!
          .from('user_profiles')
          .select(
            'user_id, tipo_cliente, url_user_contrato, url_rut_anverso, url_rut_reverso, ' +
              'url_firma, new_url_e_rut_empresa, terminos_aceptados'
          )
          .limit(2000),
        supabaseAdmin!
          .from('orders')
          .select('customer_id, status, calculated_total, pago_reserva, pago_completo, order_fecha_termino')
          .in('status', bookingStatusFilter())
          .limit(2000),
      ]);

    if (profilesError) throw profilesError;
    if (ordersError) throw ordersError;

    // Saldo por cliente, acumulado desde sus pedidos abiertos.
    const balances = new Map<number, { outstanding: number; hasOverdue: boolean }>();
    // `row` como `any` por la misma razon que en `checkInService`: los tipos generados no
    // conocen `pago_reserva` y Supabase infiere un error de consulta para la fila entera.
    for (const row of (orders ?? []) as any[]) {
      const like = {
        status: row.status,
        total: Number(row.calculated_total) || 0,
        reservePaid: !!row.pago_reserva,
        fullyPaid: !!row.pago_completo,
        endDate: row.order_fecha_termino,
      };
      const current = balances.get(row.customer_id) ?? { outstanding: 0, hasOverdue: false };
      current.outstanding += outstandingAmount(like);
      current.hasOverdue = current.hasOverdue || isOverdue(like, now);
      balances.set(row.customer_id, current);
    }

    const clients = (profiles ?? []).map((row: any) => {
      const profile: ClientProfileLike = {
        tipoCliente: row.tipo_cliente,
        contractUrl: row.url_user_contrato,
        rutFrontUrl: row.url_rut_anverso,
        rutBackUrl: row.url_rut_reverso,
        signatureUrl: row.url_firma,
        companyErutUrl: row.new_url_e_rut_empresa,
        termsAccepted: !!row.terminos_aceptados,
      };
      return {
        profile,
        balance: balances.get(row.user_id) ?? { outstanding: 0, hasOverdue: false },
      };
    });

    return clientKpis(clients);
  }
}
