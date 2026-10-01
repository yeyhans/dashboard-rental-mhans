import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `expenseService.ts` against `expenses` (T-026 gap 3). The migration
 * (`0006_t026_schema_gaps.sql`) has not been applied to any database yet, so this suite mocks
 * `supabaseAdmin` end to end — same pattern as `shippingService.test.ts` /
 * `assetMovementService.test.ts`.
 */
const state = vi.hoisted(() => ({
  list: { data: [] as any[] | null, error: null as any, count: 0 as number | null },
  insert: { data: null as any, error: null as any },
  update: { data: null as any, error: null as any },
  delete: { data: [] as any[] | null, error: null as any },
}));

vi.mock('../../lib/supabase', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== 'expenses') throw new Error(`unexpected table: ${table}`);
      return {
        select: () => ({
          order: () => ({
            range: () => Promise.resolve(state.list),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve(state.insert),
          }),
        }),
        update: () => ({
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve(state.update),
            }),
          }),
        }),
        delete: () => ({
          eq: () => ({
            select: () => Promise.resolve(state.delete),
          }),
        }),
      };
    },
  },
}));

const { ExpenseService } = await import('../expenseService');

beforeEach(() => {
  state.list = { data: [], error: null, count: 0 };
  state.insert = { data: null, error: null };
  state.update = { data: null, error: null };
  // R3-101: `.delete().eq(id).select()` returns the deleted rows. A non-empty array is the
  // default "the row existed and was removed" case; individual tests override to `[]` for the
  // nonexistent-id case.
  state.delete = { data: [{ id: 1 }], error: null };
});

describe('ExpenseService.create', () => {
  it('rejects a category outside the 11-value enum', async () => {
    await expect(
      ExpenseService.create({ category: 'not-a-category' as any, amount: 1000, expense_date: '2026-08-01' })
    ).rejects.toThrow('Categoría inválida');
  });

  it('rejects a negative amount', async () => {
    await expect(
      ExpenseService.create({ category: 'warehouse', amount: -1, expense_date: '2026-08-01' })
    ).rejects.toThrow('El monto debe ser mayor o igual a cero');
  });

  it('inserts a valid expense', async () => {
    state.insert.data = {
      id: 1,
      category: 'warehouse',
      amount: 100000,
      expense_date: '2026-08-01',
      related_order_id: null,
      related_asset_id: null,
      notes: null,
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
    };

    const result = await ExpenseService.create({
      category: 'warehouse',
      amount: 100000,
      expense_date: '2026-08-01',
    });

    expect(result.id).toBe(1);
    expect(result.category).toBe('warehouse');
  });
});

describe('ExpenseService.getAll', () => {
  it('paginates and returns the total count', async () => {
    state.list = {
      data: [{ id: 1, category: 'warehouse', amount: 1000 }],
      error: null,
      count: 1,
    };

    const result = await ExpenseService.getAll(1, 20);

    expect(result.total).toBe(1);
    expect(result.expenses).toHaveLength(1);
  });

  it('propagates a database error', async () => {
    state.list.error = { message: 'permission denied for table expenses' };

    await expect(ExpenseService.getAll(1, 20)).rejects.toMatchObject({
      message: 'permission denied for table expenses',
    });
  });
});

describe('ExpenseService.update', () => {
  it('rejects an invalid category on update', async () => {
    await expect(ExpenseService.update(1, { category: 'invalid' as any })).rejects.toThrow(
      'Categoría inválida'
    );
  });

  it('updates a valid field', async () => {
    state.update.data = { id: 1, category: 'warehouse', amount: 5000 };

    const result = await ExpenseService.update(1, { amount: 5000 });

    expect(result.amount).toBe(5000);
  });
});

describe('ExpenseService.delete', () => {
  it('deletes and returns true when the row existed', async () => {
    const result = await ExpenseService.delete(1);
    expect(result).toBe(true);
  });

  // R3-101 (CRITICAL): Supabase's `.delete().eq('id', id)` returns error:null with 0 affected
  // rows for a nonexistent id — a naive implementation reports success for a delete that deleted
  // nothing. Non-tautological: this only passes if the production code actually reads the
  // returned `data` array length instead of just checking `error`.
  it('returns false instead of reporting success when the id does not exist', async () => {
    state.delete.data = [];

    const result = await ExpenseService.delete(999);

    expect(result).toBe(false);
  });

  it('propagates a database error on delete', async () => {
    state.delete.error = { message: 'permission denied for table expenses' };
    await expect(ExpenseService.delete(1)).rejects.toMatchObject({
      message: 'permission denied for table expenses',
    });
  });
});
