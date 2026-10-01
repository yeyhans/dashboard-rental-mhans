import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Cubre el wrapper de `getShippingStats`: la agregación pura ya está en
 * `src/lib/__tests__/shippingStats.test.ts`, así que aquí solo se verifica lo que aporta el
 * servicio — las dos consultas y la normalización de cada fila antes de agregar.
 */
const state = vi.hoisted(() => ({
  methods: { data: [] as any[] | null, error: null as any },
  usage: { data: [] as any[] | null, error: null as any },
}));

vi.mock('../../lib/supabase', () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: () => Promise.resolve(table === 'shipping_methods' ? state.methods : state.usage),
    }),
  },
}));

const { ShippingService } = await import('../shippingService');

beforeEach(() => {
  state.methods = { data: [], error: null };
  state.usage = { data: [], error: null };
});

describe('ShippingService.getShippingStats', () => {
  it('cuenta los métodos totales y los activos', async () => {
    state.methods.data = [{ enabled: true }, { enabled: false }, { enabled: true }];

    const stats = await ShippingService.getShippingStats();

    expect(stats.totalMethods).toBe(3);
    expect(stats.activeMethods).toBe(2);
  });

  it('trata un status nulo como pendiente en vez de descartar la fila', async () => {
    // `shipping_usage.status` es NOT NULL con CHECK, pero la fila igual se normaliza: perderla
    // silenciosamente descuadraría el total contra la tabla.
    state.usage.data = [{ status: null, shipping_cost: 5000 }];

    const stats = await ShippingService.getShippingStats();

    expect(stats.totalShipments).toBe(1);
    expect(stats.pendingShipments).toBe(1);
  });

  it('convierte el numeric que PostgREST entrega como string', async () => {
    state.usage.data = [{ status: 'delivered', shipping_cost: '15000' }];

    const stats = await ShippingService.getShippingStats();

    expect(stats.totalRevenue).toBe('15000.00');
  });

  it('trata un costo nulo o no numérico como cero en vez de propagar NaN', async () => {
    state.usage.data = [
      { status: 'delivered', shipping_cost: null },
      { status: 'delivered', shipping_cost: 'gratis' },
    ];

    const stats = await ShippingService.getShippingStats();

    expect(stats.totalRevenue).toBe('0.00');
  });

  it('agrega sobre las dos consultas juntas', async () => {
    state.methods.data = [{ enabled: true }];
    state.usage.data = [
      { status: 'delivered', shipping_cost: 10000 },
      { status: 'pending', shipping_cost: 5000 },
      { status: 'cancelled', shipping_cost: 90000 },
    ];

    const stats = await ShippingService.getShippingStats();

    expect(stats).toEqual({
      totalMethods: 1,
      activeMethods: 1,
      totalShipments: 2,
      pendingShipments: 1,
      deliveredShipments: 1,
      totalRevenue: '15000.00',
      deliveryRate: '50.0',
    });
  });

  it('devuelve ceros cuando ambas consultas vienen vacías', async () => {
    state.methods.data = null;
    state.usage.data = null;

    const stats = await ShippingService.getShippingStats();

    expect(stats.totalMethods).toBe(0);
    expect(stats.totalShipments).toBe(0);
    expect(stats.deliveryRate).toBe('0.0');
  });

  it('propaga el error de shipping_usage en vez de devolver stats a medias', async () => {
    // Devolver "0 envíos" ante un fallo de consulta se leería como un día sin actividad.
    state.usage.error = { message: 'permission denied for table shipping_usage' };

    await expect(ShippingService.getShippingStats()).rejects.toMatchObject({
      message: 'permission denied for table shipping_usage',
    });
  });

  it('propaga el error de shipping_methods', async () => {
    state.methods.error = { message: 'relation does not exist' };

    await expect(ShippingService.getShippingStats()).rejects.toMatchObject({
      message: 'relation does not exist',
    });
  });
});
