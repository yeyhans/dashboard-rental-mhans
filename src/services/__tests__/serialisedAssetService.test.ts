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
    ilike: record('ilike'),
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
  asset_tag: 'MH-00001',
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
      asset_tag: 'MH-00001',
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
        asset_tag: 'MH-00001',
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
        asset_tag: 'MH-00001',
        serial_number: 'X-1',
        condition: 'excelente' as never,
        location: 'Bodega',
      })
    ).rejects.toThrow('Condición inválida');
    expect(from).not.toHaveBeenCalled();
  });

  it('reports a duplicate serial in Spanish instead of leaking the Postgres unique-violation code', async () => {
    const productQuery = createQueryBuilder({ data: { id: 42, status: 'publish' } });
    const insertQuery = createQueryBuilder({
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "serialised_assets_serial_number_lower_key"',
      },
    });
    from.mockImplementation((table: string) =>
      table === 'products' ? productQuery : insertQuery
    );

    const { SerialisedAssetService } = await import('../serialisedAssetService');

    await expect(
      SerialisedAssetService.createAsset({
        product_id: 42,
        asset_tag: 'MH-00002',
        serial_number: 'PROFOTO-B10-0007',
        condition: 'operational',
        location: 'Bodega',
      })
    ).rejects.toThrow('Ya existe un equipo registrado con ese número de serie');
  });

  // Asset tag (0009). The tag is scanned off a pre-printed label, so the service must accept what
  // a scanner produces and refuse what no label could carry — before the database sees it.
  it('normalises a scanned tag (lower case, trailing Enter) before inserting it', async () => {
    const productQuery = createQueryBuilder({ data: { id: 42, status: 'publish' } });
    const insertQuery = createQueryBuilder({ data: { ...sampleAsset, asset_tag: 'MH-00007' } });
    from.mockImplementation((table: string) =>
      table === 'products' ? productQuery : insertQuery
    );

    const { SerialisedAssetService } = await import('../serialisedAssetService');
    await SerialisedAssetService.createAsset({
      product_id: 42,
      asset_tag: ' mh-00007\r\n',
      serial_number: 'PROFOTO-B10-0007',
      condition: 'operational',
      location: 'Bodega',
    });

    const insert = insertQuery.calls.find((call) => call.method === 'insert');
    expect((insert?.args[0] as { asset_tag: string }).asset_tag).toBe('MH-00007');
  });

  it('rejects a malformed asset tag before touching the database', async () => {
    const { SerialisedAssetService } = await import('../serialisedAssetService');

    await expect(
      SerialisedAssetService.createAsset({
        product_id: 42,
        asset_tag: 'MH-7',
        serial_number: 'X-1',
        condition: 'operational',
        location: 'Bodega',
      })
    ).rejects.toThrow('El asset tag no tiene el formato MH-00000');
    expect(from).not.toHaveBeenCalled();
  });

  it('rejects a missing asset tag — a unit without a label cannot be scanned later', async () => {
    const { SerialisedAssetService } = await import('../serialisedAssetService');

    await expect(
      SerialisedAssetService.createAsset({
        product_id: 42,
        asset_tag: '',
        serial_number: 'X-1',
        condition: 'operational',
        location: 'Bodega',
      })
    ).rejects.toThrow('El asset tag no tiene el formato MH-00000');
    expect(from).not.toHaveBeenCalled();
  });

  // R4-003: an unrecognised UNIQUE index must not be mis-reported as a serial collision.
  it('reports an unknown 23505 constraint generically instead of blaming the serial', async () => {
    const productQuery = createQueryBuilder({ data: { id: 42, status: 'publish' } });
    const insertQuery = createQueryBuilder({
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "serialised_assets_some_future_key"',
      },
    });
    from.mockImplementation((table: string) =>
      table === 'products' ? productQuery : insertQuery
    );

    const { SerialisedAssetService } = await import('../serialisedAssetService');

    await expect(
      SerialisedAssetService.createAsset({
        product_id: 42,
        asset_tag: 'MH-00003',
        serial_number: 'SERIE-NUEVA',
        condition: 'operational',
        location: 'Bodega',
      })
    ).rejects.toThrow('Ya existe un equipo con esos datos');
  });

  it('tells a reused tag apart from a duplicate serial when Postgres reports 23505', async () => {
    const productQuery = createQueryBuilder({ data: { id: 42, status: 'publish' } });
    const insertQuery = createQueryBuilder({
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "serialised_assets_asset_tag_key"',
      },
    });
    from.mockImplementation((table: string) =>
      table === 'products' ? productQuery : insertQuery
    );

    const { SerialisedAssetService } = await import('../serialisedAssetService');

    await expect(
      SerialisedAssetService.createAsset({
        product_id: 42,
        asset_tag: 'MH-00001',
        serial_number: 'OTRA-SERIE',
        condition: 'operational',
        location: 'Bodega',
      })
    ).rejects.toThrow('El asset tag ya está asignado a otra unidad');
  });

  it('looks a unit up by asset tag with the normalised value and explicit columns', async () => {
    const query = createQueryBuilder({ data: sampleAsset });
    from.mockReturnValue(query);

    const { SerialisedAssetService } = await import('../serialisedAssetService');
    const asset = await SerialisedAssetService.getByAssetTag('mh-00001\n');

    expect(asset?.id).toBe(1);
    const filter = query.calls.find((call) => call.method === 'eq');
    expect(filter?.args).toEqual(['asset_tag', 'MH-00001']);
    const select = query.calls.find((call) => call.method === 'select');
    expect(select?.args[0]).not.toBe('*');
    expect(String(select?.args[0])).toContain('asset_tag');
  });

  it('returns null for a malformed tag without querying, and for an unassigned one', async () => {
    from.mockReturnValue(createQueryBuilder({ data: null }));

    const { SerialisedAssetService } = await import('../serialisedAssetService');

    await expect(SerialisedAssetService.getByAssetTag('MH-1')).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
    await expect(SerialisedAssetService.getByAssetTag('MH-00099')).resolves.toBeNull();
  });

  it('reports the highest assigned tag so a new roll can continue the sequence', async () => {
    const query = createQueryBuilder({ data: { asset_tag: 'MH-00041' } });
    from.mockReturnValue(query);

    const { SerialisedAssetService } = await import('../serialisedAssetService');

    await expect(SerialisedAssetService.getHighestAssetTag()).resolves.toBe('MH-00041');
    const order = query.calls.find((call) => call.method === 'order');
    expect(order?.args[0]).toBe('asset_tag');
    expect((order?.args[1] as { ascending: boolean }).ascending).toBe(false);
    expect(query.calls.some((call) => call.method === 'limit' && call.args[0] === 1)).toBe(true);
  });

  it('reports null as the highest tag before the count has started', async () => {
    from.mockReturnValue(createQueryBuilder({ data: null }));

    const { SerialisedAssetService } = await import('../serialisedAssetService');

    await expect(SerialisedAssetService.getHighestAssetTag()).resolves.toBeNull();
  });

  it('finds an asset by serial number regardless of the casing entered', async () => {
    const query = createQueryBuilder({ data: sampleAsset });
    from.mockReturnValue(query);

    const { SerialisedAssetService } = await import('../serialisedAssetService');
    const asset = await SerialisedAssetService.getAssetBySerial('  profoto-b10-0007  ');

    expect(asset?.id).toBe(1);

    // The builder double returns `sampleAsset` whatever it is asked, so asserting only that a row
    // came back would pass against a broken lookup. Assert the filter itself: `eq` is
    // case-sensitive in Postgres and would miss the stored "PROFOTO-B10-0007", which is the defect
    // this test exists to catch.
    const filter = query.calls.find((call) => ['ilike', 'eq', 'or'].includes(call.method));
    expect(filter?.method).toBe('ilike');
    expect(filter?.args[0]).toBe('serial_number');
    expect(filter?.args[1]).toBe('profoto-b10-0007');
  });

  it('treats LIKE metacharacters in a serial as literals, not wildcards', async () => {
    const query = createQueryBuilder({ data: sampleAsset });
    from.mockReturnValue(query);

    const { SerialisedAssetService } = await import('../serialisedAssetService');
    await SerialisedAssetService.getAssetBySerial('CAM_100%');

    // Unescaped, `_` matches any character and `%` any run of them, so this lookup would return
    // an unrelated unit — a wrong asset, not merely a miss.
    const filter = query.calls.find((call) => call.method === 'ilike');
    expect(filter?.args[1]).toBe('CAM\\_100\\%');
  });

  it('returns null rather than throwing when a serial is not registered', async () => {
    from.mockReturnValue(createQueryBuilder({ data: null, error: { code: 'PGRST116' } }));

    const { SerialisedAssetService } = await import('../serialisedAssetService');

    await expect(SerialisedAssetService.getAssetBySerial('NO-EXISTE')).resolves.toBeNull();
  });

  // Data-quality report. Two findings put a product on the list: a blank audited field, or a
  // counted quantity that disagrees with (or was never declared against) the client's
  // spreadsheet. A fully described product whose count matches its declaration stays off it.
  const complete = {
    brands: 'Profoto',
    type: 'simple',
    status: 'publish',
    stock_status: 'instock',
    declared_quantity: 1,
    market_value_clp: null,
    used_value_clp: null,
  };

  function mockReportQueries(products: Record<string, unknown>[], assets: { product_id: number }[]) {
    from.mockImplementation((table: string) =>
      table === 'products'
        ? createQueryBuilder({ data: products, count: products.length })
        : createQueryBuilder({ data: assets })
    );
  }

  it('flags products missing any of the five audited fields as incomplete', async () => {
    const products = [
      { ...complete, id: 1, name: 'Profoto B10', sku: null },
      { ...complete, id: 2, name: 'Canon R5', sku: 'CR5', brands: '' },
      { ...complete, id: 3, name: 'Manfrotto 055', sku: 'M055', brands: 'Manfrotto' },
    ];
    mockReportQueries(products, [{ product_id: 1 }, { product_id: 2 }, { product_id: 3 }]);

    const { SerialisedAssetService } = await import('../serialisedAssetService');
    const report = await SerialisedAssetService.getDataQualityReport();

    expect(report.total).toBe(3);
    expect(report.incomplete).toBe(2);
    expect(report.products.map((product) => product.id)).toEqual([1, 2]);
    expect(report.products[0]?.missing_fields).toEqual(['sku']);
    // An empty string is as unusable as NULL for a count sheet, and the audit counted both.
    expect(report.products[1]?.missing_fields).toEqual(['brands']);
  });

  it('flags a product whose counted units disagree with the declared quantity, even if its fields are complete', async () => {
    const products = [
      { ...complete, id: 1, name: 'Profoto B10', sku: 'B10', declared_quantity: 3 },
      { ...complete, id: 2, name: 'Canon R5', sku: 'CR5', declared_quantity: 1 },
      { ...complete, id: 3, name: 'Manfrotto 055', sku: 'M055', declared_quantity: 2 },
    ];
    // 1: two of three counted → missing. 2: two of one → extra. 3: two of two → match, off the list.
    mockReportQueries(products, [
      { product_id: 1 },
      { product_id: 1 },
      { product_id: 2 },
      { product_id: 2 },
      { product_id: 3 },
      { product_id: 3 },
    ]);

    const { SerialisedAssetService } = await import('../serialisedAssetService');
    const report = await SerialisedAssetService.getDataQualityReport();

    expect(report.incomplete).toBe(2);
    expect(report.products.map((product) => [product.id, product.discrepancy])).toEqual([
      [1, 'missing_units'],
      [2, 'extra_units'],
    ]);
    expect(report.products[0]?.counted_quantity).toBe(2);
    expect(report.products[0]?.declared_quantity).toBe(3);
    expect(report.products[0]?.missing_fields).toEqual([]);
  });

  it('flags a product with no declared quantity as undeclared and carries the model code (sku)', async () => {
    const products = [{ ...complete, id: 7, name: 'Avenger C-Stand', sku: 'AVC', declared_quantity: null }];
    mockReportQueries(products, []);

    const { SerialisedAssetService } = await import('../serialisedAssetService');
    const report = await SerialisedAssetService.getDataQualityReport();

    expect(report.products).toHaveLength(1);
    expect(report.products[0]?.discrepancy).toBe('undeclared');
    expect(report.products[0]?.sku).toBe('AVC');
    expect(report.products[0]?.counted_quantity).toBe(0);
  });

  it('derives the total from counted units and the used value, and never reads a stored total', async () => {
    const products = [
      { ...complete, id: 1, name: 'Profoto B10', sku: 'B10', declared_quantity: 5, market_value_clp: 900000, used_value_clp: 600000 },
      { ...complete, id: 2, name: 'Canon R5', sku: 'CR5', declared_quantity: 2, market_value_clp: 4000000, used_value_clp: null },
    ];
    mockReportQueries(products, [{ product_id: 1 }, { product_id: 1 }, { product_id: 1 }]);

    const { SerialisedAssetService } = await import('../serialisedAssetService');
    const report = await SerialisedAssetService.getDataQualityReport();

    const profoto = report.products.find((product) => product.id === 1);
    const canon = report.products.find((product) => product.id === 2);
    // Three counted, five declared: the count wins → 3 × 600.000.
    expect(profoto?.total_value_clp).toBe(1800000);
    expect(profoto?.market_value_clp).toBe(900000);
    // No used value → no total, not zero.
    expect(canon?.total_value_clp).toBeNull();

    const select = from.mock.calls.length > 0 ? String(from.mock.results[0]?.value?.calls?.[0]?.args?.[0] ?? '') : '';
    expect(select).not.toContain('total_value');
  });

  it('selects the three valuation columns and the sku from products for the report', async () => {
    const productQuery = createQueryBuilder({ data: [], count: 0 });
    from.mockImplementation((table: string) =>
      table === 'products' ? productQuery : createQueryBuilder({ data: [] })
    );

    const { SerialisedAssetService } = await import('../serialisedAssetService');
    await SerialisedAssetService.getDataQualityReport();

    const select = productQuery.calls.find((call) => call.method === 'select');
    const columns = String(select?.args[0]);
    for (const column of ['sku', 'declared_quantity', 'market_value_clp', 'used_value_clp']) {
      expect(columns).toContain(column);
    }
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

  // R4-001: the report reads the 0010 columns; on an instance without that migration Postgres
  // answers 42703. The service must surface it (the page degrades the panel), never swallow it.
  it('rethrows an undefined-column error from the report query instead of returning an empty report', async () => {
    const undefinedColumn = { code: '42703', message: 'column products.declared_quantity does not exist' };
    from.mockImplementation(() => createQueryBuilder({ data: null, error: undefinedColumn }));

    const { SerialisedAssetService } = await import('../serialisedAssetService');

    await expect(SerialisedAssetService.getDataQualityReport()).rejects.toEqual(undefinedColumn);
  });

  it('rethrows a failing progress query', async () => {
    const failure = { code: '57014', message: 'canceling statement due to statement timeout' };
    from.mockImplementation(() => createQueryBuilder({ data: null, error: failure }));

    const { SerialisedAssetService } = await import('../serialisedAssetService');

    await expect(SerialisedAssetService.getIntakeProgress()).rejects.toEqual(failure);
  });

  // R1-101: the per-product listing selects the columns the boards use, not `*`.
  it('lists a product’s units with the explicit asset column list', async () => {
    const listQuery = createQueryBuilder({ data: [{ id: 7, asset_tag: 'MH-00007' }] });
    from.mockImplementation(() => listQuery);

    const { SerialisedAssetService } = await import('../serialisedAssetService');
    const assets = await SerialisedAssetService.listAssetsByProduct(42);

    expect(assets).toHaveLength(1);
    const select = listQuery.calls.find((call) => call.method === 'select');
    expect(select?.args[0]).toBe(
      'id, product_id, asset_tag, serial_number, condition, location, kit_code, notes, created_at, updated_at'
    );
    expect(listQuery.calls).toContainEqual({ method: 'eq', args: ['product_id', 42] });
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
