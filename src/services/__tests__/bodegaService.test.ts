import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `BodegaService` — the queries behind the garage screens. Derivations are covered in
 * `lib/__tests__/bodega.test.ts`; this suite checks what the service adds: which tables it reads,
 * with which columns and filters, and how rows are threaded into the pure functions.
 *
 * The client double is a thenable builder: every method records itself and returns the builder,
 * `await` resolves to the canned result for that table (in call order).
 */
const state = vi.hoisted(() => ({
  results: {} as Record<string, Array<{ data: unknown; error: unknown }>>,
  calls: [] as Array<{ table: string; op: string; args: unknown[] }>,
}));

function tableBuilder(table: string) {
  const builder: any = {
    then: (resolve: (value: unknown) => void, reject?: (reason: unknown) => void) => {
      const queue = state.results[table] ?? [];
      const next = queue.shift() ?? { data: null, error: null };
      return Promise.resolve(next).then(resolve, reject);
    },
  };
  for (const op of ['select', 'in', 'eq', 'order', 'limit', 'maybeSingle']) {
    builder[op] = (...args: unknown[]) => {
      state.calls.push({ table, op, args });
      return builder;
    };
  }
  return builder;
}

vi.mock('../../lib/supabase', () => ({
  supabaseAdmin: { from: (table: string) => tableBuilder(table) },
}));

const { BodegaService } = await import('../bodegaService');

// 09:00 in Santiago (UTC-3) on 8 Sep 2026, as the UTC instant the server holds.
const NOW = new Date('2026-09-08T12:00:00Z');

const orderRow = {
  id: 1,
  order_key: 'PED-1',
  order_proyecto: 'Spot',
  order_fecha_inicio: '2026-09-09',
  order_fecha_termino: '2026-09-12',
  billing_first_name: 'Ana',
  billing_last_name: 'Pérez',
  billing_company: null,
  line_items: [{ name: 'Canon R5', product_id: 1, sku: 'R5', price: 1, quantity: 2 }],
};

beforeEach(() => {
  state.calls = [];
  state.results = {};
});

describe('BodegaService.getBoard', () => {
  it('reads awaiting-dispatch shipments with their order embedded, and the open checkouts from the view', async () => {
    state.results = {
      shipping_usage: [{ data: [{ id: 5, order_id: 1, status: 'pending', orders: orderRow }], error: null }],
      asset_current_state: [{ data: [], error: null }],
    };

    const board = await BodegaService.getBoard(NOW);

    expect(board.pickups.map((c) => c.orderId)).toEqual([1]);
    expect(board.returns).toEqual([]);

    const select = state.calls.find((c) => c.table === 'shipping_usage' && c.op === 'select');
    expect(select?.args[0]).toContain('orders (id, order_key, order_proyecto, order_fecha_inicio, order_fecha_termino');
    expect(select?.args[0]).not.toContain('*');
    expect(state.calls).toContainEqual({ table: 'shipping_usage', op: 'in', args: ['status', ['pending', 'processing']] });

    // R3-101: the state comes from the view, filtered in SQL, with NO row window.
    const stateSelect = state.calls.find((c) => c.table === 'asset_current_state' && c.op === 'select');
    expect(stateSelect?.args[0]).toBe('asset_id, order_id, direction, checked_at');
    expect(state.calls).toContainEqual({ table: 'asset_current_state', op: 'eq', args: ['direction', 'checkout'] });
    expect(state.calls.some((c) => c.table === 'asset_current_state' && c.op === 'limit')).toBe(false);
    expect(state.calls.some((c) => c.table === 'asset_movements')).toBe(false);
    // No open checkouts → no orders query at all.
    expect(state.calls.some((c) => c.table === 'orders')).toBe(false);
  });

  it('fetches the orders behind open checkouts by id and builds the returns list', async () => {
    const outOrder = { ...orderRow, id: 2, order_key: 'PED-2', order_fecha_termino: '2026-09-07' };
    state.results = {
      shipping_usage: [{ data: [], error: null }],
      asset_current_state: [
        {
          // An old checkout: the view reports it regardless of how much has moved since (R3-101).
          data: [{ asset_id: 100, order_id: 2, direction: 'checkout', checked_at: '2025-01-05T10:00:00Z' }],
          error: null,
        },
      ],
      orders: [{ data: [outOrder], error: null }],
    };

    const board = await BodegaService.getBoard(NOW);

    expect(state.calls).toContainEqual({ table: 'orders', op: 'in', args: ['id', [2]] });
    expect(board.returns).toEqual([
      expect.objectContaining({ orderId: 2, overdue: true, scannedUnits: 1, totalUnits: 2 }),
    ]);
  });

  it('rethrows a shipping_usage error', async () => {
    state.results = {
      shipping_usage: [{ data: null, error: new Error('boom') }],
      asset_current_state: [{ data: [], error: null }],
    };
    await expect(BodegaService.getBoard(NOW)).rejects.toThrow('boom');
  });

  it('rethrows a view error', async () => {
    state.results = {
      shipping_usage: [{ data: [], error: null }],
      asset_current_state: [{ data: null, error: Object.assign(new Error('relation does not exist'), { code: '42P01' }) }],
    };
    await expect(BodegaService.getBoard(NOW)).rejects.toThrow('relation does not exist');
  });
});

describe('BodegaService.getScanSheet', () => {
  it('returns null for an unknown order without reading movements', async () => {
    state.results = { orders: [{ data: null, error: null }] };
    expect(await BodegaService.getScanSheet(999)).toBeNull();
    expect(state.calls.some((c) => c.table === 'asset_movements')).toBe(false);
  });

  it('assembles the header and per-line progress from the order, its movements and the assets', async () => {
    state.results = {
      orders: [{ data: orderRow, error: null }],
      asset_movements: [
        {
          data: [{ asset_id: 100, order_id: 1, direction: 'checkout', checked_at: '2026-09-08T08:00:00Z' }],
          error: null,
        },
      ],
      serialised_assets: [{ data: [{ id: 100, product_id: 1 }], error: null }],
    };

    const sheet = await BodegaService.getScanSheet(1);

    expect(sheet?.order).toEqual({
      id: 1,
      reference: 'PED-1',
      client: 'Ana Pérez',
      project: 'Spot',
      startDate: '2026-09-09',
      endDate: '2026-09-12',
    });
    expect(sheet?.lines).toEqual([{ productId: 1, name: 'Canon R5', quantity: 2, open: 1, returned: 0 }]);
    expect(state.calls).toContainEqual({ table: 'asset_movements', op: 'eq', args: ['order_id', 1] });
    expect(state.calls).toContainEqual({ table: 'serialised_assets', op: 'in', args: ['id', [100]] });
  });

  it('skips the assets query when the order has no movements', async () => {
    state.results = {
      orders: [{ data: orderRow, error: null }],
      asset_movements: [{ data: [], error: null }],
    };
    const sheet = await BodegaService.getScanSheet(1);
    expect(sheet?.lines[0]).toMatchObject({ open: 0, returned: 0 });
    expect(state.calls.some((c) => c.table === 'serialised_assets')).toBe(false);
  });
});
