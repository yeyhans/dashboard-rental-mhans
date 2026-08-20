import { describe, expect, it } from 'vitest';
import { agendaMovementCount, buildAgenda, type AgendaOrderLike } from '../agenda';

const now = new Date('2026-06-15T10:00');

function order(partial: Partial<AgendaOrderLike> = {}): AgendaOrderLike {
  return {
    id: 1,
    reference: 'PED-1',
    client: 'Film Factory',
    project: 'Spot verano',
    status: 'confirmed',
    startDate: '2026-06-17',
    endDate: '2026-06-19',
    ...partial,
  };
}

/**
 * Las tres filas de cada día salen de las reglas operacionales: la preparación es el día ANTERIOR
 * al inicio (cuando se arma y revisa el kit), la entrega es el primer día del arriendo y la
 * devolución el último.
 */
describe('buildAgenda', () => {
  it('arma cinco días empezando hoy', () => {
    const board = buildAgenda([], now);
    expect(board).toHaveLength(5);
    expect(board[0]?.date).toBe('2026-06-15');
    expect(board[4]?.date).toBe('2026-06-19');
  });

  it('emite los días vacíos en vez de omitirlos', () => {
    // El canónico imprime "Sin entregas programadas". Una fila ausente se lee como "todavía no
    // cargó"; un "sin entregas" explícito es una afirmación sobre la que se puede planificar.
    const board = buildAgenda([], now);
    expect(board.every(d => d.preparaciones.length === 0 && d.entregas.length === 0)).toBe(true);
  });

  it('pone la preparación el día anterior al inicio', () => {
    const board = buildAgenda([order({ startDate: '2026-06-17' })], now);
    expect(board.find(d => d.date === '2026-06-16')?.preparaciones).toHaveLength(1);
  });

  it('pone la entrega el día de inicio', () => {
    const board = buildAgenda([order({ startDate: '2026-06-17' })], now);
    expect(board.find(d => d.date === '2026-06-17')?.entregas).toHaveLength(1);
  });

  it('pone la devolución el día de término', () => {
    const board = buildAgenda([order({ endDate: '2026-06-19' })], now);
    expect(board.find(d => d.date === '2026-06-19')?.devoluciones).toHaveLength(1);
  });

  it('un mismo pedido aparece en sus tres momentos', () => {
    const board = buildAgenda([order({ startDate: '2026-06-16', endDate: '2026-06-18' })], now);
    expect(board.find(d => d.date === '2026-06-15')?.preparaciones).toHaveLength(1);
    expect(board.find(d => d.date === '2026-06-16')?.entregas).toHaveLength(1);
    expect(board.find(d => d.date === '2026-06-18')?.devoluciones).toHaveLength(1);
  });

  it('descarta lo que cae fuera de la ventana de cinco días', () => {
    const board = buildAgenda([order({ startDate: '2026-07-10', endDate: '2026-07-15' })], now);
    expect(agendaMovementCount(board)).toBe(0);
  });

  it('excluye los cancelados', () => {
    // Dejarlos haría que bodega arme un kit para un arriendo que no va a ocurrir.
    const board = buildAgenda([order({ status: 'cancelled' })], now);
    expect(agendaMovementCount(board)).toBe(0);
  });

  it('reconoce el cancelado en vocabulario legado', () => {
    expect(agendaMovementCount(buildAgenda([order({ status: 'refunded' })], now))).toBe(0);
  });

  it('tolera un pedido sin fechas en vez de fallar', () => {
    const board = buildAgenda([order({ startDate: null, endDate: null })], now);
    expect(agendaMovementCount(board)).toBe(0);
  });

  it('lee la fecha como día calendario, no como medianoche UTC', () => {
    const board = buildAgenda([order({ startDate: '2026-06-17T00:00:00Z', endDate: null })], now);
    expect(board.find(d => d.date === '2026-06-17')?.entregas).toHaveLength(1);
  });
});

describe('agendaMovementCount', () => {
  it('suma los tres tipos de movimiento', () => {
    const board = buildAgenda([order({ startDate: '2026-06-16', endDate: '2026-06-18' })], now);
    expect(agendaMovementCount(board)).toBe(3);
  });

  it('devuelve cero con la agenda vacía', () => {
    expect(agendaMovementCount(buildAgenda([], now))).toBe(0);
  });
});
