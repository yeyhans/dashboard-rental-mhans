import { vi } from 'vitest';

/**
 * PostgREST client double shared by the 0021 inventory service suites. Results are queued per
 * table: each `from(table)` call takes the next queued result for that table, and every chained
 * call is recorded so a test can assert on the query that was actually built.
 *
 * Not a test file (no `.test.ts` suffix), so vitest does not collect it.
 */
export interface QueryResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

export interface RecordedCall {
  method: string;
  args: unknown[];
}

export interface BuilderDouble {
  table: string;
  calls: RecordedCall[];
  [key: string]: unknown;
}

const CHAIN_METHODS = [
  'select',
  'insert',
  'update',
  'delete',
  'upsert',
  'eq',
  'neq',
  'in',
  'is',
  'not',
  'ilike',
  'or',
  'gte',
  'lt',
  'order',
  'limit',
  'range',
];

export function createSupabaseDouble() {
  const queues = new Map<string, QueryResult[]>();
  const builders: BuilderDouble[] = [];

  function builderFor(table: string): BuilderDouble {
    const queue = queues.get(table) ?? [];
    const result = queue.shift() ?? { data: null, error: null };
    const calls: RecordedCall[] = [];
    const builder: BuilderDouble = { table, calls };
    for (const method of CHAIN_METHODS) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return builder;
      };
    }
    builder.single = vi.fn(async () => result);
    builder.maybeSingle = vi.fn(async () => result);
    builder.then = (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);
    builders.push(builder);
    return builder;
  }

  const from = vi.fn((table: string) => builderFor(table));

  return {
    client: { from },
    from,
    builders,
    /** Queue results for a table, consumed in call order. */
    queue(table: string, ...results: QueryResult[]) {
      queues.set(table, [...(queues.get(table) ?? []), ...results]);
    },
    /** Builders created for one table, in call order. */
    buildersFor(table: string) {
      return builders.filter((builder) => builder.table === table);
    },
    reset() {
      queues.clear();
      builders.length = 0;
      from.mockClear();
    },
  };
}

/** The args of the first recorded call to `method`, or undefined. */
export function callArgs(builder: BuilderDouble | undefined, method: string): unknown[] | undefined {
  return builder?.calls.find((call) => call.method === method)?.args;
}

/** Every recorded call to `method`. */
export function allCallArgs(builder: BuilderDouble | undefined, method: string): unknown[][] {
  return (builder?.calls ?? []).filter((call) => call.method === method).map((call) => call.args);
}

/**
 * One double per test file (vitest isolates module registries per file). A suite mocks
 * `lib/supabase` with `supabaseAdmin: sharedDouble.client` and drives it through this same export.
 */
export const sharedDouble = createSupabaseDouble();
