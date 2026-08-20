import { describe, expect, it } from 'vitest';
import {
  checkInKpis,
  checkInTotals,
  isLateReturn,
  itemsFromLineItems,
  returnUrgency,
  type CheckInItem,
} from '../checkIn';

const at = (iso: string) => new Date(iso);

/**
 * La urgencia de una devolución.
 *
 * La regla de negocio (`.claude/rules/01-business-context.md`) es "devolución hasta las 13:00 del
 * día siguiente al término", y pasada esa hora se cobra un día adicional por cada día de retraso.
 * Por eso `late` es un estado propio y no un matiz de `urgent`: cambia lo que el cliente debe.
 *
 * `now` se inyecta siempre. Un cálculo atado al reloj del proceso produce un test que pasa de día
 * y falla a medianoche — el mismo error que ya se evitó en `getOperationalKpis`.
 */
describe('returnUrgency', () => {
  it('el día del término la devolución está próxima', () => {
    expect(returnUrgency({ endDate: '2026-06-15', status: 'in-rental', now: at('2026-06-15T10:00') })).toBe('soon');
  });

  it('el día siguiente antes de las 13:00 es urgente', () => {
    expect(returnUrgency({ endDate: '2026-06-15', status: 'return', now: at('2026-06-16T09:00') })).toBe('urgent');
  });

  it('el día siguiente a partir de las 13:00 ya es atraso', () => {
    // Exactamente a las 13:00 el plazo venció: el límite es inclusivo del incumplimiento.
    expect(returnUrgency({ endDate: '2026-06-15', status: 'return', now: at('2026-06-16T13:00') })).toBe('late');
    expect(returnUrgency({ endDate: '2026-06-15', status: 'return', now: at('2026-06-16T18:00') })).toBe('late');
  });

  it('sigue atrasada los días posteriores, no solo el del plazo', () => {
    // Si el atraso "expirara" al día siguiente, tres días tarde desaparecería del tablero.
    expect(returnUrgency({ endDate: '2026-06-15', status: 'return', now: at('2026-06-19T08:00') })).toBe('late');
  });

  it('antes del término está simplemente agendada', () => {
    expect(returnUrgency({ endDate: '2026-06-20', status: 'in-rental', now: at('2026-06-15T10:00') })).toBe('scheduled');
  });

  it('un pedido cerrado nunca está atrasado', () => {
    expect(returnUrgency({ endDate: '2026-06-01', status: 'completed', now: at('2026-06-19T18:00') })).toBe('done');
    expect(isLateReturn({ endDate: '2026-06-01', status: 'completed', now: at('2026-06-19T18:00') })).toBe(false);
  });

  it('reconoce el estado legado del pedido cerrado', () => {
    // Durante la ventana la fila puede seguir diciendo `completed` en el vocabulario viejo, que
    // en este caso coincide; lo que importa es que se normalice y no se compare literal.
    expect(returnUrgency({ endDate: '2026-06-01', status: 'completed', now: at('2026-06-19T18:00') })).toBe('done');
  });

  it('sin fecha de término no inventa un atraso', () => {
    expect(returnUrgency({ endDate: null, status: 'in-rental', now: at('2026-06-15T10:00') })).toBe('scheduled');
  });

  it('lee la fecha como día calendario, no como medianoche UTC', () => {
    // `new Date('2026-06-15')` es medianoche UTC; en Chile (UTC-4) eso es el 14 a las 20:00, y el
    // día del término se leería corrido. Recortar la cadena evita el desfase.
    expect(returnUrgency({ endDate: '2026-06-15T00:00:00Z', status: 'return', now: at('2026-06-15T23:00') })).toBe('soon');
  });
});

describe('checkInKpis', () => {
  const now = at('2026-06-15T10:00');

  it('cuenta como pendiente lo que vence hoy y sigue abierto', () => {
    const kpis = checkInKpis([{ status: 'return', endDate: '2026-06-15' }], now);
    expect(kpis.pendientesHoy).toBe(1);
    expect(kpis.recibidosHoy).toBe(0);
  });

  it('cuenta como recibido lo que se cerró hoy', () => {
    const kpis = checkInKpis([{ status: 'completed', endDate: '2026-06-15' }], now);
    expect(kpis.recibidosHoy).toBe(1);
    expect(kpis.pendientesHoy).toBe(0);
  });

  it('mantiene en atrasadas las devoluciones vencidas de días anteriores', () => {
    const kpis = checkInKpis(
      [
        { status: 'return', endDate: '2026-06-10' },
        { status: 'return', endDate: '2026-06-12' },
      ],
      now
    );
    expect(kpis.atrasadas).toBe(2);
    // No vencen hoy, así que no son "pendientes hoy" — pero tampoco desaparecen.
    expect(kpis.pendientesHoy).toBe(0);
  });

  it('suma las incidencias declaradas', () => {
    const kpis = checkInKpis([{ status: 'return', endDate: '2026-06-15', incidentCount: 3 }], now);
    expect(kpis.incidencias).toBe(3);
  });

  it('no cuenta un pedido cerrado como atrasado aunque su plazo pasara', () => {
    const kpis = checkInKpis([{ status: 'completed', endDate: '2026-06-01' }], now);
    expect(kpis.atrasadas).toBe(0);
  });

  it('devuelve ceros con la lista vacía en vez de fallar', () => {
    expect(checkInKpis([], now)).toEqual({ pendientesHoy: 0, recibidosHoy: 0, incidencias: 0, atrasadas: 0 });
  });
});

/**
 * Los cinco contadores del panel de detalle. Cuentan UNIDADES, no líneas: el canónico muestra
 * Total 12 para un pedido de doce equipos, así que si `recibidos` contara líneas los cinco
 * números dejarían de sumar Total y nadie notaría por qué.
 */
describe('checkInTotals', () => {
  const items: CheckInItem[] = [
    { name: 'C-Stand', sku: 'CS-01', quantity: 6, state: 'received' },
    { name: 'Profoto B10', sku: 'PB-10', quantity: 2, state: 'pending' },
    { name: 'Softbox', sku: 'SB-90', quantity: 3, state: 'damaged' },
    { name: 'Cable', sku: 'CB-5', quantity: 1, state: 'incomplete' },
  ];

  it('cuenta unidades, no líneas', () => {
    const t = checkInTotals(items);
    expect(t.total).toBe(12);
    expect(t.recibidos).toBe(6);
    expect(t.pendientes).toBe(2);
    expect(t.danados).toBe(3);
    expect(t.incompletos).toBe(1);
  });

  it('los cuatro estados suman exactamente el total', () => {
    const t = checkInTotals(items);
    expect(t.recibidos + t.pendientes + t.danados + t.incompletos).toBe(t.total);
  });

  it('ignora una cantidad negativa en vez de restar del total', () => {
    const t = checkInTotals([{ name: 'X', sku: 'X', quantity: -4, state: 'received' }]);
    expect(t.total).toBe(0);
  });

  it('devuelve ceros sin ítems', () => {
    expect(checkInTotals([])).toEqual({ total: 0, recibidos: 0, incompletos: 0, danados: 0, pendientes: 0 });
  });
});

describe('itemsFromLineItems', () => {
  it('toma nombre, sku y cantidad, y parte todo en pendiente', () => {
    const items = itemsFromLineItems([
      { name: 'Profoto B10', product_id: 1, sku: 'PB-10', price: '50000', quantity: 2 },
    ]);
    expect(items).toEqual([{ name: 'Profoto B10', sku: 'PB-10', quantity: 2, state: 'pending' }]);
  });

  it('tolera line_items nulo, que es lo que devuelve una orden sin ítems', () => {
    expect(itemsFromLineItems(null)).toEqual([]);
    expect(itemsFromLineItems(undefined)).toEqual([]);
  });

  it('trata una cantidad no numérica como cero en vez de propagar NaN', () => {
    // Un NaN aquí envenena los cinco contadores y el panel muestra "NaN" sin ningún error.
    const items = itemsFromLineItems([
      { name: 'X', product_id: 1, sku: 'X', price: '0', quantity: 'dos' as never },
    ]);
    expect(items[0]?.quantity).toBe(0);
  });
});
