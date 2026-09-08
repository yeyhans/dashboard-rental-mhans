import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ORDER_STATUSES } from '../../lib/orderStatus';

/**
 * T-019. `DashboardService.getOrdersByStatus` grouped orders with a four-case `switch` on
 * `on-hold | pending | processing | completed` and no `default`.
 *
 * With seven legacy statuses that was already lossy — `cancelled`, `failed` and `refunded` fell
 * through — but those were arguably out of scope for an operational board. After migration 0003
 * it becomes a real defect: `evaluation`, `preparation`, `in-rental` and `return` are the four
 * busiest operational stages in the canonical Pedidos screen, and every one of them would fall
 * through the switch and vanish. No error, no empty state, no log line: the order is simply not
 * on the dashboard, while the equipment is out of the warehouse.
 *
 * The canonical shape is one bucket per status —
 * `Área 01 · Rental Técnico/OFF/MarioHans_OS_Area01_Pedidos_Canonical_RC2.1.2.html` lists one tab
 * per status plus Todos.
 */
const from = vi.fn();

vi.mock('../../lib/supabase', () => ({
  get supabaseAdmin() {
    return { from };
  },
}));

/** `.from().select().in().order().limit()` — the chain getOrdersByStatus builds. */
function stubOrders(rows: Array<Record<string, unknown>>) {
  from.mockReturnValue({
    select: () => ({
      in: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: rows, error: null }),
        }),
      }),
    }),
  });
}

function order(id: number, status: string) {
  return { id, status, calculated_total: 1000, total: 1000 };
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('DashboardService.getOrdersByStatus', () => {
  it('returns a bucket for every one of the eight statuses, even when empty', async () => {
    stubOrders([]);
    const { DashboardService } = await import('../dashboardService');

    const buckets = await (DashboardService as never as {
      getOrdersByStatus: () => Promise<Record<string, unknown[]>>;
    }).getOrdersByStatus();

    expect(Object.keys(buckets).sort()).toEqual([...ORDER_STATUSES].sort());
  });

  it('places an order in each v1.2 stage, including the four the old switch dropped', async () => {
    stubOrders([
      order(1, 'request'),
      order(2, 'evaluation'),
      order(3, 'confirmed'),
      order(4, 'preparation'),
      order(5, 'in-rental'),
      order(6, 'return'),
      order(7, 'completed'),
    ]);
    const { DashboardService } = await import('../dashboardService');

    const buckets = await (DashboardService as never as {
      getOrdersByStatus: () => Promise<Record<string, Array<{ id: number }>>>;
    }).getOrdersByStatus();

    expect((buckets.request ?? []).map((o) => o.id)).toEqual([1]);
    expect((buckets.evaluation ?? []).map((o) => o.id)).toEqual([2]);
    expect((buckets.confirmed ?? []).map((o) => o.id)).toEqual([3]);
    expect((buckets.preparation ?? []).map((o) => o.id)).toEqual([4]);
    expect((buckets['in-rental'] ?? []).map((o) => o.id)).toEqual([5]);
    expect((buckets.return ?? []).map((o) => o.id)).toEqual([6]);
    expect((buckets.completed ?? []).map((o) => o.id)).toEqual([7]);
  });

  it('folds a row still on a legacy status into its v1.2 bucket', async () => {
    // Between the code deploy and the 0003 apply both vocabularies are live in the table. An
    // `on-hold` row is a solicitud; showing it nowhere is the same defect in a different disguise.
    stubOrders([order(10, 'on-hold'), order(11, 'processing'), order(12, 'pending')]);
    const { DashboardService } = await import('../dashboardService');

    const buckets = await (DashboardService as never as {
      getOrdersByStatus: () => Promise<Record<string, Array<{ id: number }>>>;
    }).getOrdersByStatus();

    expect((buckets.request ?? []).map((o) => o.id)).toEqual([10, 12]);
    expect((buckets.confirmed ?? []).map((o) => o.id)).toEqual([11]);
  });

  it('drops nothing silently: every returned row lands in exactly one bucket', async () => {
    const rows = [
      order(1, 'request'),
      order(2, 'in-rental'),
      order(3, 'on-hold'),
      order(4, 'return'),
    ];
    stubOrders(rows);
    const { DashboardService } = await import('../dashboardService');

    const buckets = await (DashboardService as never as {
      getOrdersByStatus: () => Promise<Record<string, unknown[]>>;
    }).getOrdersByStatus();

    const placed = Object.values(buckets).flat().length;
    expect(placed).toBe(rows.length);
  });

  it('still fills in the calculated fields the tables render', async () => {
    stubOrders([{ id: 1, status: 'in-rental', total: 500 }]);
    const { DashboardService } = await import('../dashboardService');

    const buckets = await (DashboardService as never as {
      getOrdersByStatus: () => Promise<Record<string, Array<Record<string, number>>>>;
    }).getOrdersByStatus();

    expect((buckets['in-rental'] ?? [])[0]?.calculated_total).toBe(500);
    expect((buckets['in-rental'] ?? [])[0]?.calculated_iva).toBe(0);
  });
});
