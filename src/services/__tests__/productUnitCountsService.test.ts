import { afterEach, describe, expect, it, vi } from 'vitest';

import { callArgs, sharedDouble as db } from './supabaseDouble';

vi.mock('../../lib/supabase', async () => {
  const { sharedDouble } = await import('./supabaseDouble');
  return { supabaseAdmin: sharedDouble.client };
});

const { ProductUnitCountsService, COUNTS_MAX_PRODUCT_IDS } = await import('../productUnitCountsService');

afterEach(() => {
  db.reset();
  vi.restoreAllMocks();
});

const zero = { total: 0, available: 0, in_rental: 0, maintenance: 0, damaged: 0, blocked: 0, retired: 0 };

describe('ProductUnitCountsService.getByProductIds', () => {
  it('reads the product_unit_counts view for the requested ids, in request order, zero-filling missing rows', async () => {
    db.queue('product_unit_counts', {
      data: [{ product_id: 9, total: 3, available: 1, in_rental: 1, maintenance: 0, damaged: 1, blocked: 0, retired: 2 }],
      error: null,
    });

    const counts = await ProductUnitCountsService.getByProductIds([7, 9, 7]);

    const [query] = db.buildersFor('product_unit_counts');
    expect(callArgs(query, 'in')).toEqual(['product_id', [7, 9]]);
    expect(counts).toEqual([
      { product_id: 7, ...zero },
      { product_id: 9, total: 3, available: 1, in_rental: 1, maintenance: 0, damaged: 1, blocked: 0, retired: 2 },
    ]);
  });

  it('returns [] without a query for an empty id list', async () => {
    expect(await ProductUnitCountsService.getByProductIds([])).toEqual([]);
    expect(db.from).not.toHaveBeenCalled();
  });

  it('refuses invalid ids and oversize lists', async () => {
    await expect(ProductUnitCountsService.getByProductIds([1, -2])).rejects.toThrow();
    await expect(
      ProductUnitCountsService.getByProductIds(Array.from({ length: COUNTS_MAX_PRODUCT_IDS + 1 }, (_, i) => i + 1))
    ).rejects.toThrow();
  });

  it('rethrows database errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    db.queue('product_unit_counts', { data: null, error: { code: '42P01', message: 'relation does not exist' } });

    await expect(ProductUnitCountsService.getByProductIds([1])).rejects.toMatchObject({ code: '42P01' });
  });
});
