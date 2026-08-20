import { describe, expect, it } from 'vitest';
import {
  collectedAmount,
  financeSummary,
  isOverdue,
  isPending,
  outstandingAmount,
  paidKpis,
  pendingKpis,
  periodDelta,
  reserveAmount,
  type FinanceOrderLike,
} from '../finance';

const now = new Date('2026-06-15T10:00');

function order(partial: Partial<FinanceOrderLike> = {}): FinanceOrderLike {
  return {
    status: 'confirmed',
    total: 1_000_000,
    reservePaid: false,
    fullyPaid: false,
    endDate: '2026-06-20',
    ...partial,
  };
}

/**
 * La estructura de pago del rental: 25% de reserva al confirmar y 75% de saldo al devolver
 * (`.claude/rules/01-business-context.md`). Son TRES estados de cobro, no dos, y confundir
 * "reserva pagada" con "pagado" esconde tres cuartas partes del dinero por cobrar.
 */
describe('outstandingAmount', () => {
  it('sin pagos debe el total', () => {
    expect(outstandingAmount(order())).toBe(1_000_000);
  });

  it('con la reserva pagada debe solo el saldo', () => {
    expect(outstandingAmount(order({ reservePaid: true }))).toBe(750_000);
  });

  it('pagado completo no debe nada', () => {
    expect(outstandingAmount(order({ reservePaid: true, fullyPaid: true }))).toBe(0);
  });

  it('nunca devuelve un saldo negativo', () => {
    expect(outstandingAmount(order({ total: -5000 }))).toBe(0);
  });

  it('trata un total no numérico como cero en vez de propagar NaN', () => {
    // Un NaN aquí contamina Monto Pendiente y la tarjeta muestra "NaN" sin ningún error.
    expect(outstandingAmount(order({ total: NaN }))).toBe(0);
  });
});

describe('collectedAmount', () => {
  it('cuenta la reserva como dinero efectivamente recibido', () => {
    expect(collectedAmount(order({ reservePaid: true }))).toBe(250_000);
  });

  it('cuenta el total cuando está pagado completo', () => {
    expect(collectedAmount(order({ fullyPaid: true }))).toBe(1_000_000);
  });

  it('cuenta cero sin ningún pago', () => {
    expect(collectedAmount(order())).toBe(0);
  });

  it('lo cobrado más lo pendiente suma el total', () => {
    const o = order({ reservePaid: true });
    expect(collectedAmount(o) + outstandingAmount(o)).toBe(o.total);
  });
});

describe('reserveAmount', () => {
  it('calcula el 25% redondeado, porque el peso chileno no lleva decimales', () => {
    expect(reserveAmount(1_000_000)).toBe(250_000);
    expect(reserveAmount(333_333)).toBe(83_333);
  });
});

describe('isOverdue', () => {
  it('vence cuando el equipo ya volvió y el saldo sigue abierto', () => {
    // La regla es "saldo al devolver el equipo": el vencimiento cuelga del término del arriendo,
    // no de una fecha de factura que el esquema no tiene.
    expect(isOverdue(order({ endDate: '2026-06-10' }), now)).toBe(true);
  });

  it('no vence si el arriendo aún no termina', () => {
    expect(isOverdue(order({ endDate: '2026-06-20' }), now)).toBe(false);
  });

  it('no vence el mismo día del término', () => {
    // Ese día el equipo todavía está afuera; cobrar mora ese día sería cobrar de más.
    expect(isOverdue(order({ endDate: '2026-06-15' }), now)).toBe(false);
  });

  it('un pedido pagado nunca está vencido', () => {
    expect(isOverdue(order({ endDate: '2026-01-01', fullyPaid: true }), now)).toBe(false);
  });

  it('un pedido cancelado nunca está vencido: no se debía nada', () => {
    expect(isOverdue(order({ endDate: '2026-01-01', status: 'cancelled' }), now)).toBe(false);
  });

  it('reconoce el cancelado escrito en vocabulario legado', () => {
    // Durante la ventana la fila puede decir `failed` o `refunded`; ambos son `cancelled`.
    expect(isOverdue(order({ endDate: '2026-01-01', status: 'failed' }), now)).toBe(false);
    expect(isOverdue(order({ endDate: '2026-01-01', status: 'refunded' }), now)).toBe(false);
  });

  it('sin fecha de término no inventa un vencimiento', () => {
    expect(isOverdue(order({ endDate: null }), now)).toBe(false);
  });
});

describe('isPending', () => {
  it('excluye los cancelados de la cobranza', () => {
    expect(isPending(order({ status: 'cancelled' }))).toBe(false);
    expect(isPending(order({ status: 'failed' }))).toBe(false);
  });

  it('incluye lo que debe algo, aunque tenga la reserva pagada', () => {
    expect(isPending(order({ reservePaid: true }))).toBe(true);
  });
});

describe('pendingKpis', () => {
  it('suma el pendiente y cuenta documentos', () => {
    const k = pendingKpis([order(), order({ reservePaid: true })], now);
    expect(k.montoPendiente).toBe(1_750_000);
    expect(k.documentosPendientes).toBe(2);
  });

  it('cuenta como reserva pendiente solo lo que no pagó el 25%, y por ese 25%', () => {
    // Poner ahí el total duplicaría contra Monto Pendiente y exageraría lo cobrable hoy.
    const k = pendingKpis([order(), order({ reservePaid: true })], now);
    expect(k.reservasPendientes).toBe(1);
    expect(k.montoReservasPendientes).toBe(250_000);
  });

  it('separa lo vencido del total pendiente', () => {
    const k = pendingKpis([order({ endDate: '2026-06-01' }), order({ endDate: '2026-06-30' })], now);
    expect(k.documentosVencidos).toBe(1);
    expect(k.montoVencido).toBe(1_000_000);
    expect(k.montoPendiente).toBe(2_000_000);
  });

  it('deja fuera los cancelados', () => {
    const k = pendingKpis([order({ status: 'cancelled' })], now);
    expect(k.montoPendiente).toBe(0);
    expect(k.documentosPendientes).toBe(0);
  });

  it('devuelve ceros con la lista vacía', () => {
    const k = pendingKpis([], now);
    expect(k.montoPendiente).toBe(0);
    expect(k.documentosVencidos).toBe(0);
  });
});

describe('paidKpis', () => {
  it('promedia sobre los pedidos pagados', () => {
    const k = paidKpis([
      order({ fullyPaid: true, total: 400_000 }),
      order({ fullyPaid: true, total: 500_000 }),
      order(),
    ]);
    expect(k.pedidosPagados).toBe(2);
    expect(k.cobradoPeriodo).toBe(900_000);
    expect(k.ticketPromedio).toBe(450_000);
  });

  it('devuelve cero y no NaN sin pedidos pagados', () => {
    expect(paidKpis([order()])).toEqual({ cobradoPeriodo: 0, pedidosPagados: 0, ticketPromedio: 0 });
  });
});

describe('financeSummary', () => {
  it('separa lo facturado de lo efectivamente cobrado', () => {
    // La brecha entre ambos ES el problema de cobranza que el módulo existe para mostrar.
    const s = financeSummary([
      order({ total: 1_000_000, reservePaid: true }),
      order({ total: 1_000_000, fullyPaid: true }),
    ]);
    expect(s.ingresosPeriodo).toBe(2_000_000);
    expect(s.cobrosRecibidos).toBe(1_250_000);
    expect(s.porCobrar).toBe(750_000);
    expect(s.tasaCobranza).toBe(63);
  });

  it('no factura los cancelados', () => {
    const s = financeSummary([order({ status: 'cancelled', total: 9_000_000 })]);
    expect(s.ingresosPeriodo).toBe(0);
    expect(s.tasaCobranza).toBe(0);
  });

  it('no divide por cero cuando no hubo ingresos', () => {
    expect(financeSummary([]).tasaCobranza).toBe(0);
  });
});

describe('periodDelta', () => {
  it('calcula la variación con un decimal', () => {
    expect(periodDelta(198_420_000, 167_300_000)).toBe(18.6);
  });

  it('devuelve null cuando el período anterior fue cero', () => {
    // "+100%" sobre una base cero disfraza de tendencia lo que es el primer dato.
    expect(periodDelta(1000, 0)).toBeNull();
  });

  it('admite variación negativa', () => {
    expect(periodDelta(50, 100)).toBe(-50);
  });
});
