import { describe, expect, it } from 'vitest';
import {
  assetRotation,
  growth,
  idleAssets,
  monthlyRevenueSeries,
  periodMetrics,
  type RevenueOrderLike,
} from '../profitability';
import type { LineItem } from '../../types/order';

const now = new Date('2026-06-15T10:00');

function item(partial: Partial<LineItem> = {}): LineItem {
  return { name: 'Profoto B10', product_id: 1, sku: 'PB-10', price: '50000', quantity: 1, ...partial };
}

function order(partial: Partial<RevenueOrderLike> = {}): RevenueOrderLike {
  return {
    status: 'completed',
    total: 500_000,
    jornadas: 2,
    createdAt: '2026-06-10',
    lineItems: [item()],
    ...partial,
  };
}

describe('periodMetrics', () => {
  it('suma ingresos y jornadas de lo facturable', () => {
    const m = periodMetrics([order({ total: 300_000, jornadas: 2 }), order({ total: 200_000, jornadas: 3 })]);
    expect(m.ingresos).toBe(500_000);
    expect(m.jornadasVendidas).toBe(5);
    expect(m.pedidosRealizados).toBe(2);
    expect(m.ticketPromedio).toBe(250_000);
  });

  it('excluye los cancelados: nunca facturaron', () => {
    const m = periodMetrics([order({ status: 'cancelled', total: 900_000 })]);
    expect(m.ingresos).toBe(0);
    expect(m.pedidosRealizados).toBe(0);
  });

  it('reconoce el cancelado en vocabulario legado', () => {
    expect(periodMetrics([order({ status: 'failed', total: 900_000 })]).ingresos).toBe(0);
  });

  it('cuenta equipos DISTINTOS, no unidades', () => {
    // Un pedido de diez trípodes iguales es UN activo trabajando, no diez.
    const m = periodMetrics([
      order({ lineItems: [item({ product_id: 7, quantity: 10 })] }),
      order({ lineItems: [item({ product_id: 7 }), item({ product_id: 9 })] }),
    ]);
    expect(m.equiposUtilizados).toBe(2);
  });

  it('no confunde el id numérico con el mismo id en texto', () => {
    // `line_items` es jsonb: el mismo producto puede llegar como 7 o como "7".
    const m = periodMetrics([order({ lineItems: [item({ product_id: 7 }), item({ product_id: '7' })] })]);
    expect(m.equiposUtilizados).toBe(1);
  });

  it('devuelve cero y no NaN sin pedidos', () => {
    expect(periodMetrics([])).toEqual({
      ingresos: 0,
      jornadasVendidas: 0,
      pedidosRealizados: 0,
      ticketPromedio: 0,
      equiposUtilizados: 0,
    });
  });

  it('ignora jornadas negativas en vez de restarlas del total', () => {
    expect(periodMetrics([order({ jornadas: -5 })]).jornadasVendidas).toBe(0);
  });
});

describe('monthlyRevenueSeries', () => {
  it('emite doce meses terminando en el actual', () => {
    const serie = monthlyRevenueSeries([], now);
    expect(serie).toHaveLength(12);
    expect(serie[11]?.month).toBe('2026-06');
    expect(serie[0]?.month).toBe('2025-07');
  });

  it('emite en cero los meses sin pedidos en vez de omitirlos', () => {
    // Saltarse un mes vacío comprime el eje y convierte un trimestre muerto en una línea suave.
    const serie = monthlyRevenueSeries([order({ createdAt: '2026-06-10', total: 100_000 })], now);
    expect(serie.filter(m => m.ingresos === 0)).toHaveLength(11);
    expect(serie[11]?.ingresos).toBe(100_000);
  });

  it('descarta lo que cae fuera de la ventana', () => {
    const serie = monthlyRevenueSeries([order({ createdAt: '2024-01-05', total: 999_999 })], now);
    expect(serie.reduce((s, m) => s + m.ingresos, 0)).toBe(0);
  });

  it('no cuenta cancelados en la serie', () => {
    const serie = monthlyRevenueSeries([order({ createdAt: '2026-06-10', status: 'cancelled' })], now);
    expect(serie[11]?.pedidos).toBe(0);
  });
});

describe('assetRotation', () => {
  it('atribuye el ingreso por línea: precio × cantidad × jornadas', () => {
    // Repartir el total del pedido entre sus ítems contaría el mismo dinero una vez por línea.
    const rot = assetRotation([
      order({ jornadas: 3, lineItems: [item({ product_id: 1, price: '50000', quantity: 2 })] }),
    ]);
    expect(rot[0]?.revenue).toBe(300_000);
    expect(rot[0]?.jornadas).toBe(6);
    expect(rot[0]?.rentals).toBe(1);
  });

  it('acumula el mismo producto a través de pedidos', () => {
    const rot = assetRotation([
      order({ jornadas: 1, lineItems: [item({ product_id: 1, price: '10000', quantity: 1 })] }),
      order({ jornadas: 1, lineItems: [item({ product_id: 1, price: '10000', quantity: 1 })] }),
    ]);
    expect(rot).toHaveLength(1);
    expect(rot[0]?.rentals).toBe(2);
    expect(rot[0]?.revenue).toBe(20_000);
  });

  it('ordena por ingreso descendente', () => {
    const rot = assetRotation([
      order({ jornadas: 1, lineItems: [item({ product_id: 1, name: 'Bajo', price: '1000' })] }),
      order({ jornadas: 1, lineItems: [item({ product_id: 2, name: 'Alto', price: '90000' })] }),
    ]);
    expect(rot[0]?.name).toBe('Alto');
  });

  it('ignora una línea sin product_id en vez de agrupar bajo undefined', () => {
    const rot = assetRotation([order({ lineItems: [item({ product_id: null as never })] })]);
    expect(rot).toHaveLength(0);
  });

  it('trata un precio no numérico como cero', () => {
    const rot = assetRotation([order({ lineItems: [item({ price: 'gratis' })] })]);
    expect(rot[0]?.revenue).toBe(0);
  });
});

describe('idleAssets', () => {
  it('nombra los equipos del catálogo que no facturaron nada', () => {
    // Es el único punto de "Atención" del canónico que los datos SÍ pueden responder: un activo
    // ausente de todo pedido es capital ocioso, y decirlo es accionable sin saber su costo.
    const rot = assetRotation([order({ lineItems: [item({ product_id: 1 })] })]);
    const idle = idleAssets([{ id: 1, name: 'Usado' }, { id: 2, name: 'Ocioso' }], rot);
    expect(idle).toEqual([{ id: '2', name: 'Ocioso' }]);
  });

  it('compara ids como texto, porque line_items es jsonb', () => {
    const rot = assetRotation([order({ lineItems: [item({ product_id: '3' })] })]);
    expect(idleAssets([{ id: 3, name: 'Usado' }], rot)).toEqual([]);
  });

  it('con el catálogo vacío no inventa activos ociosos', () => {
    expect(idleAssets([], [])).toEqual([]);
  });
});

describe('growth', () => {
  it('calcula la variación con un decimal', () => {
    expect(growth(132.7, 100)).toBe(32.7);
  });

  it('devuelve null sin base de comparación', () => {
    expect(growth(500, 0)).toBeNull();
  });
});
