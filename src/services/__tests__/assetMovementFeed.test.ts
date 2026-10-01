import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `AssetMovementService.listFeed` (batch 3). The derivations are covered in
 * `lib/__tests__/movementsFeed.test.ts`; this suite verifies the queries — embeds, filters,
 * limit clamp — and the row shaping. Thenable builder double, same as `bodegaService.test.ts`.
 */
const state = vi.hoisted(() => ({
  results: {} as Record<string, Array<{ data: unknown; error: unknown; count?: number | null }>>,
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
  for (const op of ['select', 'in', 'eq', 'gte', 'lt', 'order', 'limit']) {
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

const { AssetMovementService, FEED_MAX_LIMIT } = await import('../assetMovementService');

// 12:00 in Santiago (UTC-3) on 8 Sep 2026, as the UTC instant the server holds.
const NOW = new Date('2026-09-08T15:00:00Z');

const feedRow = {
  id: 1,
  asset_id: 100,
  order_id: 10,
  direction: 'checkout',
  condition_notes: null,
  checked_by_admin_id: 7,
  checked_at: '2026-09-08T09:00:00Z',
  serialised_assets: { id: 100, asset_tag: 'MH-00100', serial_number: 'SN-A', product_id: 1, products: { name: 'Canon R5' } },
  orders: {
    id: 10,
    billing_first_name: 'Ana',
    billing_last_name: 'Pérez',
    billing_company: null,
    order_proyecto: 'Spot',
    order_fecha_termino: '2026-09-05',
  },
  admin_users: { id: 7, email: 'bodega@mariohans.cl' },
};

beforeEach(() => {
  state.calls = [];
  state.results = {
    // Call order inside listFeed: the feed query, then the count of today's movements.
    asset_movements: [
      { data: [feedRow], error: null },
      { data: null, error: null, count: 1 },
    ],
    // The 0012 view, already filtered to checkouts.
    asset_current_state: [
      { data: [{ asset_id: 100, order_id: 10, direction: 'checkout', checked_at: '2026-09-08T09:00:00Z' }], error: null },
    ],
    orders: [{ data: [{ id: 10, order_fecha_termino: '2026-09-05' }], error: null }],
  };
});

describe('AssetMovementService.listFeed', () => {
  it('embeds unit, model, order and operator with explicit columns and no select(*)', async () => {
    await AssetMovementService.listFeed({}, NOW);
    const select = state.calls.find((c) => c.table === 'asset_movements' && c.op === 'select');
    const columns = String(select?.args[0]);
    expect(columns).toContain('serialised_assets (id, asset_tag, serial_number, product_id, products (name))');
    expect(columns).toContain('orders (id, billing_first_name, billing_last_name, billing_company, order_proyecto, order_fecha_termino)');
    expect(columns).toContain('admin_users (id, email)');
    expect(columns).not.toContain('*');
  });

  it('shapes rows, resolves the client name and flags an open checkout on an overdue order', async () => {
    const feed = await AssetMovementService.listFeed({}, NOW);
    expect(feed.movements).toEqual([
      {
        id: 1,
        direction: 'checkout',
        checked_at: '2026-09-08T09:00:00Z',
        condition_notes: null,
        asset: { id: 100, asset_tag: 'MH-00100', serial_number: 'SN-A', product_id: 1 },
        product: { name: 'Canon R5' },
        order: { id: 10, client: 'Ana Pérez', project: 'Spot', endDate: '2026-09-05' },
        operator: { id: 7, email: 'bodega@mariohans.cl' },
        overdue: true,
      },
    ]);
    expect(feed.kpis).toEqual({ unitsOutNow: 1, unitsOverdue: 1, movementsToday: 1 });
    expect(feed.operators).toEqual([{ id: 7, email: 'bodega@mariohans.cl' }]);
    expect(feed.generatedAt).toBe(NOW.toISOString());
  });

  it('applies since/until/direction/operator filters server-side, newest first', async () => {
    await AssetMovementService.listFeed(
      { since: '2026-09-08T00:00:00.000Z', until: '2026-09-09T00:00:00.000Z', direction: 'checkin', adminId: 7, limit: 50 },
      NOW
    );
    const feedCalls = state.calls.filter((c) => c.table === 'asset_movements');
    expect(feedCalls).toContainEqual({ table: 'asset_movements', op: 'gte', args: ['checked_at', '2026-09-08T00:00:00.000Z'] });
    expect(feedCalls).toContainEqual({ table: 'asset_movements', op: 'lt', args: ['checked_at', '2026-09-09T00:00:00.000Z'] });
    expect(feedCalls).toContainEqual({ table: 'asset_movements', op: 'eq', args: ['direction', 'checkin'] });
    expect(feedCalls).toContainEqual({ table: 'asset_movements', op: 'eq', args: ['checked_by_admin_id', 7] });
    expect(feedCalls).toContainEqual({ table: 'asset_movements', op: 'limit', args: [50] });
    expect(feedCalls).toContainEqual({ table: 'asset_movements', op: 'order', args: ['checked_at', { ascending: false }] });
  });

  it('clamps the limit to FEED_MAX_LIMIT and applies no filter by default', async () => {
    await AssetMovementService.listFeed({ limit: 99999 }, NOW);
    const feedCalls = state.calls.filter((c) => c.table === 'asset_movements');
    expect(feedCalls.find((c) => c.op === 'limit')?.args).toEqual([FEED_MAX_LIMIT]);
    // No `since`/`until` on the feed: the only `gte` on asset_movements is the today-count query.
    expect(feedCalls.some((c) => c.op === 'lt')).toBe(false);
    expect(feedCalls.filter((c) => c.op === 'gte')).toHaveLength(1);
  });

  it('tolerates a movement whose unit, order or operator was deleted', async () => {
    state.results.asset_movements![0] = {
      data: [{ ...feedRow, serialised_assets: null, orders: null, admin_users: null }],
      error: null,
    };
    const feed = await AssetMovementService.listFeed({}, NOW);
    expect(feed.movements[0]).toMatchObject({ asset: null, product: null, order: null, operator: null });
    expect(feed.operators).toEqual([]);
  });

  it('skips the orders query when nothing is out', async () => {
    state.results.asset_current_state![0] = { data: [], error: null };
    state.results.asset_movements![1] = { data: null, error: null, count: 0 };
    const feed = await AssetMovementService.listFeed({}, NOW);
    expect(state.calls.some((c) => c.table === 'orders')).toBe(false);
    expect(feed.kpis).toEqual({ unitsOutNow: 0, unitsOverdue: 0, movementsToday: 0 });
    expect(feed.movements[0]?.overdue).toBe(false);
  });

  // R3-101: units out come from the view, not from a window of recent rows.
  it('reads open checkouts from asset_current_state with no row limit, and counts today in the database', async () => {
    await AssetMovementService.listFeed({}, NOW);

    const stateCalls = state.calls.filter((c) => c.table === 'asset_current_state');
    expect(stateCalls.find((c) => c.op === 'select')?.args[0]).toBe('asset_id, order_id, direction, checked_at');
    expect(stateCalls).toContainEqual({ table: 'asset_current_state', op: 'eq', args: ['direction', 'checkout'] });
    expect(stateCalls.some((c) => c.op === 'limit')).toBe(false);

    const countCall = state.calls.find((c) => c.table === 'asset_movements' && c.op === 'select' && (c.args[1] as any)?.head === true);
    expect(countCall?.args[1]).toEqual({ count: 'exact', head: true });
    const gte = state.calls.find((c) => c.table === 'asset_movements' && c.op === 'gte');
    expect(gte?.args[0]).toBe('checked_at');
    // Santiago midnight of 8 Sep (UTC-3), not the server's (R3-104).
    expect(gte?.args[1]).toBe('2026-09-08T03:00:00.000Z');
  });

  it('counts "today" from Santiago midnight even when UTC has already moved to the next day (R3-104)', async () => {
    await AssetMovementService.listFeed({}, new Date('2026-09-09T02:30:00Z')); // 23:30 -03 on 8 Sep
    const gte = state.calls.find((c) => c.table === 'asset_movements' && c.op === 'gte');
    expect(gte?.args[1]).toBe('2026-09-08T03:00:00.000Z');
  });

  it('reports a checkout with no later checkin as out regardless of how many other movements exist', async () => {
    // The view row is a year old; the feed page shows only recent rows. The KPI must still say 1.
    state.results.asset_current_state![0] = {
      data: [{ asset_id: 7, order_id: 10, direction: 'checkout', checked_at: '2025-09-08T09:00:00Z' }],
      error: null,
    };
    state.results.asset_movements![1] = { data: null, error: null, count: 4321 };
    const feed = await AssetMovementService.listFeed({}, NOW);
    expect(feed.kpis).toEqual({ unitsOutNow: 1, unitsOverdue: 1, movementsToday: 4321 });
  });

  it('rethrows a view error', async () => {
    state.results.asset_current_state![0] = { data: null, error: new Error('relation "asset_current_state" does not exist') };
    await expect(AssetMovementService.listFeed({}, NOW)).rejects.toThrow('asset_current_state');
  });

  it('rethrows a feed query error', async () => {
    state.results.asset_movements![0] = { data: null, error: new Error('boom') };
    await expect(AssetMovementService.listFeed({}, NOW)).rejects.toThrow('boom');
  });
});
