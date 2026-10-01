import { describe, expect, it } from 'vitest';
import { shippingStats, type ShippingStatsInput } from '../shippingStats';

function shipment(partial: Partial<ShippingStatsInput>): ShippingStatsInput {
  return { status: 'delivered', cost: 0, ...partial };
}

describe('shippingStats', () => {
  it('cuenta los envíos por estado', () => {
    const s = shippingStats(
      [
        shipment({ status: 'pending' }),
        shipment({ status: 'processing' }),
        shipment({ status: 'shipped' }),
        shipment({ status: 'delivered' }),
      ],
      { totalMethods: 3, activeMethods: 2 }
    );

    expect(s.totalShipments).toBe(4);
    expect(s.pendingShipments).toBe(2); // pending + processing: aún no salen de bodega
    expect(s.deliveredShipments).toBe(1);
  });

  it('excluye los cancelados del volumen y de la recaudación', () => {
    // Nunca salieron: contarlos inflaría la cifra con la que se liquida al courier.
    const s = shippingStats(
      [shipment({ status: 'delivered', cost: 10000 }), shipment({ status: 'cancelled', cost: 90000 })],
      { totalMethods: 1, activeMethods: 1 }
    );

    expect(s.totalShipments).toBe(1);
    expect(s.totalRevenue).toBe('10000.00');
  });

  it('formatea la recaudación con dos decimales, como espera el consumidor', () => {
    const s = shippingStats([shipment({ cost: 2450000 })], { totalMethods: 0, activeMethods: 0 });
    expect(s.totalRevenue).toBe('2450000.00');
  });

  it('trata un costo no numérico como cero en vez de propagar NaN', () => {
    const s = shippingStats([shipment({ cost: NaN })], { totalMethods: 0, activeMethods: 0 });
    expect(s.totalRevenue).toBe('0.00');
  });

  it('calcula la tasa de entrega sobre los envíos contados', () => {
    const s = shippingStats(
      [
        ...Array(9).fill(null).map(() => shipment({ status: 'delivered' })),
        shipment({ status: 'shipped' }),
      ],
      { totalMethods: 0, activeMethods: 0 }
    );
    expect(s.deliveryRate).toBe('90.0');
  });

  it('devuelve 0.0 y no NaN cuando no hay envíos', () => {
    // Una división por cero aquí se renderiza como "NaN%" en la tarjeta, sin ningún error.
    const s = shippingStats([], { totalMethods: 5, activeMethods: 4 });

    expect(s).toEqual({
      totalMethods: 5,
      activeMethods: 4,
      totalShipments: 0,
      pendingShipments: 0,
      deliveredShipments: 0,
      totalRevenue: '0.00',
      deliveryRate: '0.0',
    });
  });

  it('no divide por cero cuando todos los envíos están cancelados', () => {
    const s = shippingStats([shipment({ status: 'cancelled', cost: 5000 })], {
      totalMethods: 1,
      activeMethods: 0,
    });
    expect(s.totalShipments).toBe(0);
    expect(s.deliveryRate).toBe('0.0');
  });

  it('ignora un estado fuera del CHECK en pendientes y entregados', () => {
    const s = shippingStats([shipment({ status: 'inventado', cost: 1000 })], {
      totalMethods: 0,
      activeMethods: 0,
    });
    expect(s.pendingShipments).toBe(0);
    expect(s.deliveredShipments).toBe(0);
    expect(s.totalShipments).toBe(1);
  });
});
