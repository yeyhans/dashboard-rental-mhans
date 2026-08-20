import { describe, expect, it } from 'vitest';
import {
  deliveryKpis,
  formatCLP,
  historyTotals,
  isAwaitingDispatch,
  shipmentLabel,
  type ShipmentLike,
} from '../delivery';

const now = new Date('2026-06-15T10:00');

function shipment(partial: Partial<ShipmentLike>): ShipmentLike {
  return { status: 'delivered', cost: 0, createdAt: '2026-06-15', deliveredAt: null, ...partial };
}

describe('shipmentLabel', () => {
  it('traduce los cinco estados del CHECK', () => {
    expect(shipmentLabel('pending')).toBe('Pendiente');
    expect(shipmentLabel('shipped')).toBe('En ruta');
    expect(shipmentLabel('delivered')).toBe('Entregado');
  });

  it('devuelve el valor crudo si la DB trae algo fuera del CHECK', () => {
    expect(shipmentLabel('inventado')).toBe('inventado');
  });
});

describe('isAwaitingDispatch', () => {
  it('cuenta lo registrado que aún no sale', () => {
    expect(isAwaitingDispatch('pending')).toBe(true);
    expect(isAwaitingDispatch('processing')).toBe(true);
  });

  it('no cuenta lo que ya salió ni lo cerrado', () => {
    // `shipped` ya está en la calle: incluirlo inflaría la cola de bodega.
    expect(isAwaitingDispatch('shipped')).toBe(false);
    expect(isAwaitingDispatch('delivered')).toBe(false);
    expect(isAwaitingDispatch('cancelled')).toBe(false);
  });
});

describe('deliveryKpis', () => {
  it('cuenta los envíos creados hoy', () => {
    const k = deliveryKpis([shipment({ createdAt: '2026-06-15' }), shipment({ createdAt: '2026-06-14' })], now);
    expect(k.enviosHoy).toBe(1);
    expect(k.enviosAyer).toBe(1);
  });

  it('calcula la variación contra ayer', () => {
    const items = [
      ...Array(6).fill(null).map(() => shipment({ createdAt: '2026-06-15' })),
      ...Array(5).fill(null).map(() => shipment({ createdAt: '2026-06-14' })),
    ];
    expect(deliveryKpis(items, now).variacionDiaria).toBe(20);
  });

  it('devuelve null y no Infinity cuando ayer no hubo envíos', () => {
    // Dividir por cero imprimiría "Infinity%", y reportar "+100%" por un envío tras un día en
    // blanco disfraza de tendencia lo que es ruido. La vista muestra "sin referencia".
    const k = deliveryKpis([shipment({ createdAt: '2026-06-15' })], now);
    expect(k.variacionDiaria).toBeNull();
  });

  it('cuenta como entregado hoy por delivered_at, no por created_at', () => {
    // Un envío creado el lunes y entregado hoy es una entrega de HOY.
    const k = deliveryKpis(
      [shipment({ status: 'delivered', createdAt: '2026-06-10', deliveredAt: '2026-06-15' })],
      now
    );
    expect(k.entregadosHoy).toBe(1);
    expect(k.enviosHoy).toBe(0);
  });

  it('excluye los cancelados del volumen y del costo', () => {
    // Nunca salieron: sumarlos infla la cifra con la que se liquida al courier.
    const k = deliveryKpis(
      [shipment({ status: 'cancelled', cost: 50000, createdAt: '2026-06-15' })],
      now
    );
    expect(k.enviosHoy).toBe(0);
    expect(k.costoHoy).toBe(0);
  });

  it('acumula el costo en las tres ventanas', () => {
    const k = deliveryKpis(
      [
        shipment({ cost: 10000, createdAt: '2026-06-15' }),
        shipment({ cost: 20000, createdAt: '2026-06-12' }),
        shipment({ cost: 30000, createdAt: '2026-06-02' }),
      ],
      now
    );
    expect(k.costoHoy).toBe(10000);
    expect(k.costoSemana).toBe(30000); // hoy + el del 12, dentro de los últimos 7 días
    expect(k.costoMes).toBe(60000);
  });

  it('no cuenta en el mes un envío del mes anterior', () => {
    const k = deliveryKpis([shipment({ cost: 99000, createdAt: '2026-05-31' })], now);
    expect(k.costoMes).toBe(0);
  });

  it('no cuenta en el mes un envío con fecha futura', () => {
    // Una fecha adelantada sumaría a un mes que aún no termina y descuadraría la liquidación.
    const k = deliveryKpis([shipment({ cost: 99000, createdAt: '2026-06-28' })], now);
    expect(k.costoMes).toBe(0);
  });

  it('trata un costo no numérico como cero en vez de propagar NaN', () => {
    const k = deliveryKpis([shipment({ cost: NaN, createdAt: '2026-06-15' })], now);
    expect(k.costoHoy).toBe(0);
  });

  it('devuelve ceros sin envíos', () => {
    const k = deliveryKpis([], now);
    expect(k.enviosHoy).toBe(0);
    expect(k.variacionDiaria).toBeNull();
    expect(k.costoMes).toBe(0);
  });
});

describe('historyTotals', () => {
  it('promedia sobre los envíos contados', () => {
    const t = historyTotals([shipment({ cost: 10000 }), shipment({ cost: 20000 })]);
    expect(t.totalEnvios).toBe(2);
    expect(t.costoTotal).toBe(30000);
    expect(t.promedioPorEnvio).toBe(15000);
  });

  it('devuelve cero y no NaN con el historial vacío', () => {
    // Un NaN aquí se renderiza como "NaN" en la tarjeta, sin ningún error en ninguna parte.
    expect(historyTotals([])).toEqual({ totalEnvios: 0, costoTotal: 0, promedioPorEnvio: 0 });
  });

  it('excluye los cancelados también del promedio', () => {
    const t = historyTotals([shipment({ cost: 10000 }), shipment({ status: 'cancelled', cost: 90000 })]);
    expect(t.totalEnvios).toBe(1);
    expect(t.promedioPorEnvio).toBe(10000);
  });
});

describe('formatCLP', () => {
  it('formatea sin decimales, que es como se usa el peso chileno', () => {
    expect(formatCLP(45000)).toBe('$45.000');
    expect(formatCLP(1287500)).toBe('$1.287.500');
  });

  it('redondea en vez de mostrar centavos', () => {
    expect(formatCLP(15147.4)).toBe('$15.147');
  });
});
