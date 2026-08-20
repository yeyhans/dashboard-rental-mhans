import { supabaseAdmin } from '../lib/supabase';
import { activeStatusFilter, canonicalStatus } from '../lib/orderStatus';
import { checkInKpis, returnUrgency, type CheckInKpis, type ReturnUrgency } from '../lib/checkIn';
import type { LineItem } from '../types/order';

/** One row of the canonical `.list-panel`. */
export interface CheckInListEntry {
  id: number;
  reference: string;
  client: string;
  project: string;
  status: string;
  endDate: string | null;
  urgency: ReturnUrgency;
  itemCount: number;
  lineItems: LineItem[];
}

export interface CheckInBoard {
  kpis: CheckInKpis;
  entries: CheckInListEntry[];
}

/**
 * Data for Check-In / Devoluciones.
 *
 * The board shows every return still open plus the ones closed today, which is why the query is
 * not "orders whose end date is today": a return three days late is the row that most needs to be
 * on screen, and filtering by today's date is precisely how it would vanish.
 */
export class CheckInService {
  private static ensureSupabaseAdmin() {
    if (!supabaseAdmin) throw new Error('Supabase admin client is not initialized');
  }

  /** `now` is injected so the board is deterministic and testable. */
  static async getBoard(now: Date = new Date()): Promise<CheckInBoard> {
    CheckInService.ensureSupabaseAdmin();

    const { data, error } = await supabaseAdmin!
      .from('orders')
      .select(
        'id, order_key, status, order_proyecto, order_fecha_termino, ' +
          'billing_first_name, billing_last_name, billing_company, line_items'
      )
      // Etapas en curso más las cerradas: el canónico lista ambas, marcando las segundas como
      // completadas. `activeStatusFilter()` abarca los dos vocabularios durante la ventana.
      .in('status', [...activeStatusFilter(), 'completed'])
      .order('order_fecha_termino', { ascending: true })
      .limit(200);

    if (error) throw error;

    const rows = data ?? [];
    const entries: CheckInListEntry[] = rows.map(row => {
      const lineItems = Array.isArray(row.line_items) ? (row.line_items as LineItem[]) : [];
      const company = row.billing_company?.trim();
      const person = `${row.billing_first_name ?? ''} ${row.billing_last_name ?? ''}`.trim();

      return {
        id: row.id,
        reference: row.order_key || `PED-${row.id}`,
        client: company || person || 'Sin cliente',
        project: row.order_proyecto || 'Sin proyecto',
        status: canonicalStatus(row.status) ?? row.status,
        endDate: row.order_fecha_termino,
        urgency: returnUrgency({ endDate: row.order_fecha_termino, status: row.status, now }),
        itemCount: lineItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
        lineItems,
      };
    });

    const kpis = checkInKpis(
      rows.map(row => ({ status: row.status, endDate: row.order_fecha_termino })),
      now
    );

    // Lo urgente primero: atrasadas, luego lo que vence hoy, y las cerradas al final.
    const rank: Record<ReturnUrgency, number> = { late: 0, urgent: 1, soon: 2, scheduled: 3, done: 4 };
    entries.sort((a, b) => rank[a.urgency] - rank[b.urgency] || (a.endDate ?? '').localeCompare(b.endDate ?? ''));

    return { kpis, entries };
  }
}
