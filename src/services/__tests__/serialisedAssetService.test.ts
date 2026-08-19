import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * T-035 / T-036. `serialised-inventory-operations/spec.md`:
 *   - "Serialised-asset intake UI ships ahead of client-facing polish"
 *   - "Intake data quality does not block entry, but is flagged"
 *   - "External dependency status is observable"
 *
 * The intake path must not consult the product's completeness before writing. The client's
 * physical count (ADR-003, O-5) runs against a catalogue with missing `sku`/`brands`/`type`/
 * `status`/`stock_status`, so a validation that reads those fields would stall the count this
 * whole batch exists to unblock.
 */

interface QueryResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

/**
 * Minimal PostgREST builder double. Every filter method returns the builder, so the service can
 * chain freely; the terminal call resolves whatever the test queued. `calls` records the chain so
 * a test can assert on the query that was actually built, not just on its result.
 */
interface RecordedCall {
  method: string;
  args: unknown[];
}

interface QueryBuilderDouble {
  calls: RecordedCall[];
  [key: string]: unknown;
}

function createQueryBuilder(result: QueryResult): QueryBuilderDouble {
  const calls: RecordedCall[] = [];
  const record = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return builder;
  };

  const builder: QueryBuilderDouble = {
    calls,
    select: record('select'),
    insert: record('insert'),
    eq: record('eq'),
    or: record('or'),
    in: record('in'),
    order: record('order'),
    limit: record('limit'),
    range: record('range'),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve),
  };

  return builder;
}

const from = vi.fn();
const supabaseAdmin = { from };

vi.mock('../../lib/supabase', () => ({ supabaseAdmin }));

const sampleAsset = {
  id: 1,
  product_id: 42,
  serial_number: 'PROFOTO-B10-0007',
  condition: 'operational',
  location: 'Bodega Purísima',
  kit_code: 'KIT-LUZ-01',
  notes: null,
  created_at: '2026-08-18T10:00:00.000Z',
  updated_at: '2026-08-18T10:00:00.000Z',
};

describe('SerialisedAssetService', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('records an asset against a product whose sku, brands and stock_status are all missing', async () => {
    const incompleteProduct = {
      id: 42,
      name: 'Profoto B10',
      slug: 'profoto-b10',
      status: 'publish',
      sku: null,
      brands: null,
      type: null,
      stock_status: null,
    };
    const productQuery = createQueryBuilder({ data: incompleteProduct });
    const insertQuery = createQueryBuilder({ data: sampleAsset });
    from.mockImplementation((table: string) =>
      table === 'products' ? productQuery : insertQuery
    );

    const { SerialisedAssetService } = await import('../serialisedAssetService');
    const asset = await SerialisedAssetService.createAsset({
      product_id: 42,
      serial_number: 'PROFOTO-B10-0007',
      condition: 'operational',
      location: 'Bodega Purísima',
      kit_code: 'KIT-LUZ-01',
    });

    expect(asset.serial_number).toBe('PROFOTO-B10-0007');
    expect(insertQuery.calls.some((call) => call.method === 'insert')).toBe(true);
  });

  it('rejects an asset whose product does not exist, so serials cannot orphan', async () => {
    const productQuery = createQueryBuilder({ data: null, error: { code: 'PGRST116' } });
    from.mockReturnValue(productQuery);

    const { SerialisedAssetService } = await import('../serialisedAssetService');

    await expect(
      SerialisedAssetService.createAsset({
        product_id: 999,
        serial_number: 'X-1',
        condition: 'operational',
        location: 'Bodega',
      })
    ).rejects.toThrow('El producto indicado no existe');
  });

  it('rejects an unknown condition before touching the database', async () => {
    const { SerialisedAssetService } = await import('../serialisedAssetService');

    await expect(
      SerialisedAssetService.createAsset({
        product_id: 42,
        serial_number: 'X-1',
        condition: 'excelente' as never,
        location: 'Bodega',
      })
    ).rejects.toThrow('Condición inválida');
    expect(from).not.toHaveBeenCalled();
  });

  it('reports a duplicate serial in Spanish instead of leaking the Postgres unique-violation code', async () => {
    const productQuery = createQueryBuilder({ data: { id: 42, status: 'publish' } });
    const insertQuery = createQueryBuilder({ data: null, error: { code: '23505' } });
    from.mockImplementation((table: string) =>
      table === 'products' ? productQuery : insertQuery
    );

    const { SerialisedAssetService } = await import('../serialisedAssetService');

    await expect(
      SerialisedAssetService.createAsset({
        product_id: 42,
        serial_number: 'PROFOTO-B10-0007',
        condition: 'operational',
        location: 'Bodega',
      })
    ).rejects.toThrow('Ya existe un equipo registrado con ese número de serie');
  });

  it('finds an asset by serial number regardless of the casing entered', async () => {
    const query = createQueryBuilder({ data: sampleAsset });
    from.mockReturnValue(query);

    const { SerialisedAssetService } = await import('../serialisedAssetService');
    const asset = await SerialisedAssetService.getAssetBySerial('  profoto-b10-0007  ');

    expect(asset?.id).toBe(1);
    const ilike = query.calls.find((call) => call.method === 'eq' || call.method === 'or');
    expect(ilike).toBeDefined();
  });

  it('returns null rather than throwing when a serial is not registered', async () => {
    from.mockReturnValue(createQueryBuilder({ data: null, error: { code: 'PGRST116' } }));

    const { SerialisedAssetService } = await import('../serialisedAssetService');

    await expect(SerialisedAssetService.getAssetBySerial('NO-EXISTE')).resolves.toBeNull();
  });

  it('flags products missing any of the five audited fields as incomplete', async () => {
    const products = [
      { id: 1, name: 'Profoto B10', status: 'publish', sku: null, brands: 'Profoto', type: 'simple', stock_status: 'instock' },
      { id: 2, name: 'Canon R5', status: 'publish', sku: 'CR5', brands: '', type: 'simple', stock_status: 'instock' },
      { id: 3, name: 'Manfrotto 055', status: 'publish', sku: 'M055', brands: 'Manfrotto', type: 'simple', stock_status: 'instock' },
    ];
    from.mockReturnValue(createQueryBuilder({ data: products, count: products.length }));

    const { SerialisedAssetService } = await import('../serialisedAssetService');
    const report = await SerialisedAssetService.getDataQualityReport();

    expect(report.total).toBe(3);
    expect(report.products.map((product) => product.id)).toEqual([1, 2]);
    expect(report.products[0]?.missing_fields).toEqual(['sku']);
    // An empty string is as unusable as NULL for a count sheet, and the audit counted both.
    expect(report.products[1]?.missing_fields).toEqual(['brands']);
  });

  it('reports intake progress as published products covered versus published products total', async () => {
    const publishedQuery = createQueryBuilder({ data: [{ id: 1 }, { id: 2 }, { id: 3 }], count: 3 });
    const assetsQuery = createQueryBuilder({ data: [{ product_id: 1 }, { product_id: 1 }, { product_id: 3 }] });
    from.mockImplementation((table: string) =>
      table === 'products' ? publishedQuery : assetsQuery
    );

    const { SerialisedAssetService } = await import('../serialisedAssetService');
    const progress = await SerialisedAssetService.getIntakeProgress();

    expect(progress.published_products).toBe(3);
    // Two distinct products carry assets, not three asset rows.
    expect(progress.products_with_assets).toBe(2);
    expect(progress.total_assets).toBe(3);
    expect(progress.completion_percentage).toBe(67);
  });

  it('reports zero progress without dividing by zero on an empty catalogue', async () => {
    const publishedQuery = createQueryBuilder({ data: [], count: 0 });
    const assetsQuery = createQueryBuilder({ data: [] });
    from.mockImplementation((table: string) =>
      table === 'products' ? publishedQuery : assetsQuery
    );

    const { SerialisedAssetService } = await import('../serialisedAssetService');
    const progress = await SerialisedAssetService.getIntakeProgress();

    expect(progress.completion_percentage).toBe(0);
  });
});
