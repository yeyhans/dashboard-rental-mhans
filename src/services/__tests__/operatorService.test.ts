import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OPERATOR_ERRORS } from '../../lib/operators';

/**
 * `OperatorService` against `admin_users` (0011) and Supabase Auth's admin API. Same boundary
 * mock as `assetMovementService.test.ts`: `supabaseAdmin` is replaced by a recorder so the suite
 * can assert WHICH calls happen and in what order — the create path is two writes with a manual
 * rollback, and the order is the whole point.
 */
const state = vi.hoisted(() => ({
  createUser: { data: null as any, error: null as any },
  deleteUser: { error: null as any },
  insert: { data: null as any, error: null as any },
  update: { data: null as any, error: null as any },
  list: { data: [] as any[], error: null as any },
  calls: [] as Array<{ op: string; args?: unknown }>,
}));

vi.mock('../../lib/supabase', () => ({
  invalidateAdminCache: (userId: string) => state.calls.push({ op: 'invalidateAdminCache', args: userId }),
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: async (payload: unknown) => {
          state.calls.push({ op: 'auth.createUser', args: payload });
          return state.createUser;
        },
        deleteUser: async (id: string) => {
          state.calls.push({ op: 'auth.deleteUser', args: id });
          return state.deleteUser;
        },
      },
    },
    from: (table: string) => {
      if (table !== 'admin_users') throw new Error(`unexpected table: ${table}`);
      const filters: unknown[] = [];
      const builder: any = {
        select: (cols: string) => {
          state.calls.push({ op: 'select', args: cols });
          return builder;
        },
        eq: (col: string, val: unknown) => {
          filters.push([col, val]);
          state.calls.push({ op: 'eq', args: [col, val] });
          return builder;
        },
        order: () => Promise.resolve(state.list),
        insert: (row: unknown) => {
          state.calls.push({ op: 'insert', args: row });
          return { select: () => ({ single: () => Promise.resolve(state.insert) }) };
        },
        update: (patch: unknown) => {
          state.calls.push({ op: 'update', args: patch });
          return builder;
        },
        single: () => Promise.resolve(state.update),
      };
      return builder;
    },
  },
}));

const { OperatorService } = await import('../operatorService');

const operatorRow = {
  id: 12,
  user_id: 'auth-op-1',
  email: 'bodega@mariohans.cl',
  role: 'operator',
  is_active: true,
  created_at: '2026-09-08T10:00:00Z',
};

beforeEach(() => {
  state.calls = [];
  state.createUser = { data: { user: { id: 'auth-op-1' } }, error: null };
  state.deleteUser = { error: null };
  state.insert = { data: operatorRow, error: null };
  state.update = { data: operatorRow, error: null };
  state.list = { data: [operatorRow], error: null };
});

describe('OperatorService.list', () => {
  it('selects explicit columns and only operators', async () => {
    const rows = await OperatorService.list();
    expect(rows).toEqual([operatorRow]);
    const select = state.calls.find((c) => c.op === 'select');
    expect(select?.args).toBe('id, user_id, email, role, is_active, created_at');
    expect(state.calls).toContainEqual({ op: 'eq', args: ['role', 'operator'] });
  });

  it('rethrows a query error', async () => {
    state.list = { data: [], error: new Error('boom') };
    await expect(OperatorService.list()).rejects.toThrow('boom');
  });
});

describe('OperatorService.create', () => {
  it('creates the Auth user with the email confirmed, then the admin_users row', async () => {
    const created = await OperatorService.create({ email: 'bodega@mariohans.cl', password: 'correcto1' });

    expect(created).toEqual(operatorRow);
    expect(state.calls[0]).toEqual({
      op: 'auth.createUser',
      args: { email: 'bodega@mariohans.cl', password: 'correcto1', email_confirm: true },
    });
    expect(state.calls).toContainEqual({
      op: 'insert',
      args: { user_id: 'auth-op-1', email: 'bodega@mariohans.cl', role: 'operator', is_active: true },
    });
  });

  it('stores an optional display name in the auth metadata only', async () => {
    await OperatorService.create({ email: 'a@b.cl', password: 'correcto1', displayName: 'Juan' });
    expect(state.calls[0]?.args).toEqual(
      expect.objectContaining({ user_metadata: { display_name: 'Juan' } })
    );
    const insert = state.calls.find((c) => c.op === 'insert');
    expect(insert?.args).not.toHaveProperty('display_name');
  });

  it('maps "already been registered" to the Spanish EMAIL_TAKEN message and inserts nothing', async () => {
    state.createUser = { data: null, error: { message: 'A user with this email address has already been registered' } };

    await expect(OperatorService.create({ email: 'a@b.cl', password: 'correcto1' })).rejects.toThrow(
      OPERATOR_ERRORS.EMAIL_TAKEN
    );
    expect(state.calls.some((c) => c.op === 'insert')).toBe(false);
  });

  it('deletes the Auth user again when the row insert fails, then rethrows', async () => {
    const dbError = Object.assign(new Error('check constraint'), { code: '23514' });
    state.insert = { data: null, error: dbError };

    await expect(OperatorService.create({ email: 'a@b.cl', password: 'correcto1' })).rejects.toBe(dbError);

    const ops = state.calls.map((c) => c.op);
    expect(ops.indexOf('auth.deleteUser')).toBeGreaterThan(ops.indexOf('insert'));
    expect(state.calls).toContainEqual({ op: 'auth.deleteUser', args: 'auth-op-1' });
  });

  it('still rethrows the row error when the rollback itself fails (orphan is logged)', async () => {
    const dbError = new Error('insert failed');
    state.insert = { data: null, error: dbError };
    state.deleteUser = { error: new Error('delete failed') };

    await expect(OperatorService.create({ email: 'a@b.cl', password: 'correcto1' })).rejects.toBe(dbError);
  });
});

describe('OperatorService.setActive', () => {
  it('updates is_active scoped to operators and drops the session cache for that user', async () => {
    const inactive = { ...operatorRow, is_active: false };
    state.update = { data: inactive, error: null };

    const result = await OperatorService.setActive(12, false);

    expect(result).toEqual(inactive);
    expect(state.calls).toContainEqual({ op: 'update', args: { is_active: false } });
    expect(state.calls).toContainEqual({ op: 'eq', args: ['id', 12] });
    expect(state.calls).toContainEqual({ op: 'eq', args: ['role', 'operator'] });
    expect(state.calls.at(-1)).toEqual({ op: 'invalidateAdminCache', args: 'auth-op-1' });
  });

  it('returns null when no operator has that id (an admin id is not an operator)', async () => {
    state.update = { data: null, error: { code: 'PGRST116', message: 'no rows' } };
    expect(await OperatorService.setActive(1, false)).toBeNull();
    expect(state.calls.some((c) => c.op === 'invalidateAdminCache')).toBe(false);
  });

  it('rethrows other errors', async () => {
    state.update = { data: null, error: new Error('timeout') };
    await expect(OperatorService.setActive(12, true)).rejects.toThrow('timeout');
  });
});
