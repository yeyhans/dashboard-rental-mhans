import { describe, expect, it } from 'vitest';

import {
  DIRECTION_LABELS,
  filterFeed,
  hasActiveFilters,
  isLatestRequest,
  isOverdueRow,
  kpis,
  overdueOrderIds,
  overdueOut,
  parseInstant,
  startOfBusinessDay,
} from '../movementsFeed';

const TODAY = '2026-09-08';
// 11:00 in Santiago (UTC-3) on 8 Sep 2026, written as the UTC instant the server would hold.
const NOW = new Date('2026-09-08T14:00:00Z');

function m(id: number, assetId: number, orderId: number, direction: 'checkout' | 'checkin', at: string, adminId: number | null = 7) {
  return { id, asset_id: assetId, order_id: orderId, direction, checked_at: at, checked_by_admin_id: adminId };
}

describe('overdueOrderIds / overdueOut', () => {
  const orders = [
    { id: 10, order_fecha_termino: '2026-09-07' }, // overdue
    { id: 11, order_fecha_termino: '2026-09-08' }, // due today, not overdue
    { id: 12, order_fecha_termino: null },
  ];

  it('flags only end dates strictly before today', () => {
    expect([...overdueOrderIds(orders, TODAY)]).toEqual([10]);
  });

  it('keeps the open checkouts on overdue orders', () => {
    const open = [m(1, 100, 10, 'checkout', 'x'), m(2, 101, 11, 'checkout', 'x'), m(3, 102, 99, 'checkout', 'x')];
    expect(overdueOut(open, orders, TODAY).map((x) => x.asset_id)).toEqual([100]);
  });

  it('isOverdueRow needs all three: a checkout, still open, on an overdue order', () => {
    const openIds = new Set([100]);
    const overdue = new Set([10]);
    expect(isOverdueRow(m(1, 100, 10, 'checkout', 'x'), openIds, overdue)).toBe(true);
    expect(isOverdueRow(m(1, 100, 10, 'checkin', 'x'), openIds, overdue)).toBe(false);
    expect(isOverdueRow(m(1, 101, 10, 'checkout', 'x'), openIds, overdue)).toBe(false);
    expect(isOverdueRow(m(1, 100, 11, 'checkout', 'x'), openIds, overdue)).toBe(false);
  });
});

describe('kpis', () => {
  it('counts the open checkouts (view rows), the overdue ones, and passes today’s count through', () => {
    const result = kpis(
      // Already one row per unit: the `asset_current_state` view filtered to checkouts.
      [m(1, 100, 10, 'checkout', '2025-01-06T10:00:00Z'), m(2, 101, 11, 'checkout', '2026-09-08T09:00:00Z')],
      [
        { id: 10, order_fecha_termino: '2026-09-05' },
        { id: 11, order_fecha_termino: '2026-09-10' },
      ],
      NOW,
      3
    );
    expect(result).toEqual({ unitsOutNow: 2, unitsOverdue: 1, movementsToday: 3 });
  });

  it('is all zeros on an empty feed', () => {
    expect(kpis([], [], NOW, 0)).toEqual({ unitsOutNow: 0, unitsOverdue: 0, movementsToday: 0 });
  });
});

describe('startOfBusinessDay (R3-104)', () => {
  it('is Santiago midnight, not server midnight', () => {
    // 23:30 -03 on 8 Sep: UTC already says 9 Sep, Chile does not.
    expect(startOfBusinessDay(new Date('2026-09-09T02:30:00Z'))).toBe('2026-09-08T03:00:00.000Z');
    expect(startOfBusinessDay(new Date('2026-09-09T03:00:00Z'))).toBe('2026-09-09T03:00:00.000Z');
  });
});

describe('kpis — the overdue rule reads today in Santiago', () => {
  it('an order ending 8 Sep is not overdue at 23:30 Santiago on 8 Sep, even though UTC is 9 Sep', () => {
    const lateEvening = new Date('2026-09-09T02:30:00Z');
    const result = kpis([m(1, 100, 10, 'checkout', '2026-09-01T10:00:00Z')], [{ id: 10, order_fecha_termino: '2026-09-08' }], lateEvening, 0);
    expect(result.unitsOverdue).toBe(0);
    // Half an hour later, Santiago's 9 Sep has begun.
    expect(kpis([m(1, 100, 10, 'checkout', 'x')], [{ id: 10, order_fecha_termino: '2026-09-08' }], new Date('2026-09-09T03:00:00Z'), 0).unitsOverdue).toBe(1);
  });
});

describe('isLatestRequest (R4-102)', () => {
  it('only the most recently started request may apply its response', () => {
    expect(isLatestRequest(3, 3)).toBe(true);
    expect(isLatestRequest(2, 3)).toBe(false);
    expect(isLatestRequest(4, 3)).toBe(false);
  });
});

describe('hasActiveFilters (R2-102)', () => {
  it('is a value check, not an identity check', () => {
    expect(hasActiveFilters({ direction: '', adminId: '', from: '', to: '' })).toBe(false);
    expect(hasActiveFilters({ ...{ direction: '', adminId: '', from: '', to: '' } })).toBe(false);
    expect(hasActiveFilters({ direction: 'checkin', adminId: '', from: '', to: '' })).toBe(true);
    expect(hasActiveFilters({ direction: '', adminId: '', from: '2026-09-08', to: '' })).toBe(true);
  });
});

describe('filterFeed', () => {
  const rows = [
    m(1, 100, 10, 'checkout', '2026-09-08T09:00:00Z', 7),
    m(2, 101, 10, 'checkin', '2026-09-08T10:00:00Z', 8),
    m(3, 102, 11, 'checkout', '2026-09-08T11:00:00Z', null),
  ];

  it('applies direction, operator and the [since, until) window', () => {
    expect(filterFeed(rows, { direction: 'checkout' }).map((r) => r.id)).toEqual([1, 3]);
    expect(filterFeed(rows, { adminId: 8 }).map((r) => r.id)).toEqual([2]);
    expect(filterFeed(rows, { since: '2026-09-08T10:00:00.000Z' }).map((r) => r.id)).toEqual([2, 3]);
    expect(filterFeed(rows, { until: '2026-09-08T10:00:00.000Z' }).map((r) => r.id)).toEqual([1]);
    expect(filterFeed(rows, {}).map((r) => r.id)).toEqual([1, 2, 3]);
  });
});

describe('parseInstant', () => {
  it('normalises a valid instant, returns null for absent, undefined for garbage', () => {
    expect(parseInstant('2026-09-08T10:00:00Z')).toBe('2026-09-08T10:00:00.000Z');
    expect(parseInstant(null)).toBeNull();
    expect(parseInstant('')).toBeNull();
    expect(parseInstant('ayer')).toBeUndefined();
  });
});

describe('DIRECTION_LABELS', () => {
  it('is the Spanish badge copy', () => {
    expect(DIRECTION_LABELS).toEqual({ checkout: 'Salida', checkin: 'Entrada' });
  });
});
