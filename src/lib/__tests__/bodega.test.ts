import { describe, expect, it } from 'vitest';

import {
  addDays,
  buildBodegaBoard,
  clientName,
  formatDay,
  isPickupDue,
  isReturnDue,
  isReturnOverdue,
  isoDay,
  openCheckoutsByOrder,
  pickupCards,
  projectLabel,
  returnCards,
  scanSheetLines,
  unitsInOrder,
  type BodegaMovementLike,
  type BodegaOrderLike,
} from '../bodega';

/**
 * The garage board. Boundaries are the whole test: "today or tomorrow" for pickups, "today or
 * earlier" for returns, and a return past its end date flagged `Atrasada`. Days are strings so a
 * UTC-4 midnight cannot move a date by one.
 */
const TODAY = '2026-09-08';
// 10:30 in Santiago (UTC-3) on 8 Sep 2026, as the UTC instant a Vercel server would hold.
const NOW = new Date('2026-09-08T13:30:00Z');

function order(overrides: Partial<BodegaOrderLike> & { id: number }): BodegaOrderLike {
  return {
    order_key: `PED-${overrides.id}`,
    order_proyecto: 'Campaña',
    billing_first_name: 'Ana',
    billing_last_name: 'Pérez',
    billing_company: null,
    line_items: [
      { name: 'Canon R5', product_id: 1, sku: 'R5', price: '1', quantity: 2 },
      { name: 'Profoto B10', product_id: 2, sku: 'B10', price: '1', quantity: 1 },
    ],
    ...overrides,
  };
}

function movement(assetId: number, orderId: number, direction: 'checkout' | 'checkin', at: string): BodegaMovementLike {
  return { asset_id: assetId, order_id: orderId, direction, checked_at: at };
}

describe('day helpers', () => {
  it('isoDay slices strings (date columns) and reads instants in Santiago', () => {
    expect(isoDay('2026-09-08T03:00:00Z')).toBe('2026-09-08');
    expect(isoDay(NOW)).toBe(TODAY);
  });

  // R3-104: the server is UTC; 23:30 in Santiago must still be "today" for the board.
  it('isoDay does not roll the day over at 21:00 Chile time', () => {
    expect(isoDay(new Date('2026-09-09T02:30:00Z'))).toBe('2026-09-08'); // 23:30 -03
    expect(isoDay(new Date('2026-09-09T03:00:00Z'))).toBe('2026-09-09'); // 00:00 -03
  });

  it('addDays crosses month and year ends', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('formatDay is DD/MM/YYYY without parsing', () => {
    expect(formatDay('2026-09-08')).toBe('08/09/2026');
    expect(formatDay(null)).toBe('—');
  });
});

describe('isPickupDue — today or tomorrow, inclusive', () => {
  it.each([
    ['2026-09-08', true],
    ['2026-09-09', true],
    ['2026-09-10', false],
    ['2026-09-07', false],
  ])('start %s → %s', (start, expected) => {
    expect(isPickupDue(start, TODAY)).toBe(expected);
  });

  it('is false without a start date', () => {
    expect(isPickupDue(null, TODAY)).toBe(false);
    expect(isPickupDue(undefined, TODAY)).toBe(false);
  });
});

describe('isReturnDue / isReturnOverdue', () => {
  it('due on the end date and after; overdue only after', () => {
    expect(isReturnDue('2026-09-08', TODAY)).toBe(true);
    expect(isReturnOverdue('2026-09-08', TODAY)).toBe(false);
    expect(isReturnDue('2026-09-07', TODAY)).toBe(true);
    expect(isReturnOverdue('2026-09-07', TODAY)).toBe(true);
    expect(isReturnDue('2026-09-09', TODAY)).toBe(false);
    expect(isReturnOverdue('2026-09-09', TODAY)).toBe(false);
  });

  it('never due without an end date', () => {
    expect(isReturnDue(null, TODAY)).toBe(false);
    expect(isReturnOverdue(null, TODAY)).toBe(false);
  });
});

describe('unitsInOrder / clientName', () => {
  it('sums quantities, ignoring garbage', () => {
    expect(unitsInOrder([{ quantity: 2 }, { quantity: '3' }, { quantity: -1 }, { quantity: 'x' }] as never)).toBe(5);
    expect(unitsInOrder(null)).toBe(0);
  });

  it('prefers the company, then the person, then a placeholder', () => {
    expect(clientName(order({ id: 1, billing_company: ' Productora ' }))).toBe('Productora');
    expect(clientName(order({ id: 1 }))).toBe('Ana Pérez');
    expect(clientName({})).toBe('Sin cliente');
  });

  it('projectLabel trims and falls back to "Sin proyecto"', () => {
    expect(projectLabel({ order_proyecto: '  Spot  ' })).toBe('Spot');
    expect(projectLabel({ order_proyecto: '   ' })).toBe('Sin proyecto');
    expect(projectLabel({ order_proyecto: null })).toBe('Sin proyecto');
    expect(projectLabel({})).toBe('Sin proyecto');
  });
});

describe('openCheckoutsByOrder', () => {
  it('keeps only assets whose latest movement is a checkout, grouped by that order', () => {
    const byOrder = openCheckoutsByOrder([
      movement(1, 10, 'checkout', '2026-09-01T10:00:00Z'),
      movement(1, 10, 'checkin', '2026-09-03T10:00:00Z'), // back — not open
      movement(2, 10, 'checkout', '2026-09-02T10:00:00Z'),
      movement(3, 11, 'checkout', '2026-09-02T10:00:00Z'),
      movement(3, 11, 'checkin', '2026-09-04T10:00:00Z'),
      movement(3, 12, 'checkout', '2026-09-05T10:00:00Z'), // re-lent on another order
    ]);
    expect([...(byOrder.get(10) ?? [])]).toEqual([2]);
    expect(byOrder.has(11)).toBe(false);
    expect([...(byOrder.get(12) ?? [])]).toEqual([3]);
  });

  it('is order-independent — the latest checked_at wins, not the last row', () => {
    const byOrder = openCheckoutsByOrder([
      movement(1, 10, 'checkin', '2026-09-03T10:00:00Z'),
      movement(1, 10, 'checkout', '2026-09-01T10:00:00Z'),
    ]);
    expect(byOrder.size).toBe(0);
  });
});

describe('pickupCards', () => {
  it('lists awaiting-dispatch shipments starting today or tomorrow, soonest first, one per order', () => {
    const cards = pickupCards(
      [
        { status: 'pending', order: order({ id: 2, order_fecha_inicio: '2026-09-09' }) },
        { status: 'processing', order: order({ id: 1, order_fecha_inicio: '2026-09-08' }) },
        { status: 'pending', order: order({ id: 1, order_fecha_inicio: '2026-09-08' }) }, // duplicate shipment row
        { status: 'shipped', order: order({ id: 3, order_fecha_inicio: '2026-09-08' }) }, // already out
        { status: 'pending', order: order({ id: 4, order_fecha_inicio: '2026-09-10' }) }, // too early
        { status: 'pending', order: null },
      ],
      new Map([[1, new Set([100])]]),
      TODAY
    );
    expect(cards.map((c) => c.orderId)).toEqual([1, 2]);
    expect(cards[0]).toMatchObject({ reference: 'PED-1', scannedUnits: 1, totalUnits: 3, overdue: false });
    expect(cards[1]?.scannedUnits).toBe(0);
  });
});

describe('returnCards', () => {
  it('lists orders with units out whose end date has arrived, overdue first', () => {
    const open = new Map([
      [10, new Set([1, 2])],
      [11, new Set([3])],
      [12, new Set([4])],
      [13, new Set([5])],
    ]);
    const cards = returnCards(
      [
        order({ id: 10, order_fecha_termino: '2026-09-08' }), // due today
        order({ id: 11, order_fecha_termino: '2026-09-05' }), // overdue
        order({ id: 12, order_fecha_termino: '2026-09-09' }), // tomorrow — not yet
        order({ id: 13, order_fecha_termino: null }),
        order({ id: 14, order_fecha_termino: '2026-09-01' }), // nothing out
      ],
      open,
      TODAY
    );
    expect(cards.map((c) => [c.orderId, c.overdue])).toEqual([
      [11, true],
      [10, false],
    ]);
    // 3 listed units, 2 still out → 1 back.
    expect(cards[1]?.scannedUnits).toBe(1);
  });

  it('never reports a negative return count', () => {
    const cards = returnCards(
      [order({ id: 10, order_fecha_termino: '2026-09-01', line_items: [] })],
      new Map([[10, new Set([1, 2])]]),
      TODAY
    );
    expect(cards[0]?.scannedUnits).toBe(0);
  });
});

describe('scanSheetLines', () => {
  const items = order({ id: 1 }).line_items!;
  const assetProducts = new Map([
    [100, 1],
    [101, 1],
    [200, 2],
    [300, 9],
  ]);

  it('starts every line at zero when nothing has moved', () => {
    expect(scanSheetLines(items, [], assetProducts)).toEqual([
      { productId: 1, name: 'Canon R5', quantity: 2, open: 0, returned: 0 },
      { productId: 2, name: 'Profoto B10', quantity: 1, open: 0, returned: 0 },
    ]);
  });

  it('counts each asset once, by its latest movement on this order', () => {
    const lines = scanSheetLines(
      items,
      [
        movement(100, 1, 'checkout', '2026-09-01T10:00:00Z'),
        movement(101, 1, 'checkout', '2026-09-01T10:01:00Z'),
        movement(101, 1, 'checkin', '2026-09-03T10:00:00Z'),
        movement(200, 1, 'checkout', '2026-09-01T10:02:00Z'),
        movement(300, 1, 'checkout', '2026-09-01T10:03:00Z'), // product 9: not on the order
        movement(999, 1, 'checkout', '2026-09-01T10:04:00Z'), // unknown asset
      ],
      assetProducts
    );
    expect(lines).toEqual([
      { productId: 1, name: 'Canon R5', quantity: 2, open: 1, returned: 1 },
      { productId: 2, name: 'Profoto B10', quantity: 1, open: 1, returned: 0 },
    ]);
  });

  it('merges duplicate product lines and skips malformed ones', () => {
    const lines = scanSheetLines(
      [
        { name: 'Canon R5', product_id: '1', sku: '', price: '1', quantity: 1 },
        { name: 'Canon R5', product_id: 1, sku: '', price: '1', quantity: 2 },
        { name: 'Sin id', product_id: 'abc', sku: '', price: '1', quantity: 1 },
      ],
      [],
      assetProducts
    );
    expect(lines).toEqual([{ productId: 1, name: 'Canon R5', quantity: 3, open: 0, returned: 0 }]);
  });
});

describe('buildBodegaBoard — Santiago day boundary (R3-104)', () => {
  const shipments = [{ status: 'pending', order: order({ id: 1, order_fecha_inicio: '2026-09-09' }) }];
  const orders = [order({ id: 2, order_fecha_termino: '2026-09-08' })];
  const movements = [movement(7, 2, 'checkout', '2026-09-04T12:00:00Z')];

  it('at 23:30 Santiago on 8 Sep: pickup for the 9th is "tomorrow", return due the 8th is not overdue', () => {
    const board = buildBodegaBoard({ now: new Date('2026-09-09T02:30:00Z'), shipments, orders, movements });
    expect(board.pickups.map((c) => c.orderId)).toEqual([1]);
    expect(board.returns.map((c) => [c.orderId, c.overdue])).toEqual([[2, false]]);
  });

  it('at 00:00 Santiago on 9 Sep: the pickup is "today" and the return is overdue', () => {
    const board = buildBodegaBoard({ now: new Date('2026-09-09T03:00:00Z'), shipments, orders, movements });
    expect(board.pickups.map((c) => c.orderId)).toEqual([1]);
    expect(board.returns.map((c) => [c.orderId, c.overdue])).toEqual([[2, true]]);
  });
});

describe('buildBodegaBoard', () => {
  it('derives both lists from raw rows and the injected clock', () => {
    const board = buildBodegaBoard({
      now: NOW,
      shipments: [{ status: 'pending', order: order({ id: 1, order_fecha_inicio: '2026-09-09' }) }],
      orders: [order({ id: 2, order_fecha_termino: '2026-09-06' })],
      movements: [movement(7, 2, 'checkout', '2026-09-04T12:00:00Z')],
    });
    expect(board.pickups.map((c) => c.orderId)).toEqual([1]);
    expect(board.returns.map((c) => [c.orderId, c.overdue])).toEqual([[2, true]]);
  });
});
