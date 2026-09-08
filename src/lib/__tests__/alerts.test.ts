import { describe, expect, it } from 'vitest';
import { buildAlerts, isPickupDue, type AlertOrderLike } from '../alerts';

const now = new Date('2026-06-15T10:00');

function order(partial: Partial<AlertOrderLike> = {}): AlertOrderLike {
  return {
    id: 1,
    reference: 'PED-1',
    client: 'Film Factory',
    status: 'confirmed',
    total: 1_000_000,
    reservePaid: true,
    fullyPaid: false,
    startDate: '2026-06-20',
    endDate: '2026-06-25',
    hasContract: true,
    ...partial,
  };
}

/**
 * La ventana de retiro. El retiro es el día ANTERIOR al inicio del arriendo, 15:00–20:00
 * (`.claude/rules/01-business-context.md`). La alerta se abre desde ese día: avisar la mañana del
 * retiro es lo que da tiempo a perseguir una transferencia o una firma. Avisar el día de inicio
 * ya no alcanza para arreglar nada.
 */
describe('isPickupDue', () => {
  it('se abre el día anterior al inicio', () => {
    expect(isPickupDue('2026-06-16', now)).toBe(true);
  });

  it('sigue abierta el día de inicio', () => {
    expect(isPickupDue('2026-06-15', now)).toBe(true);
  });

  it('no se abre con dos días de anticipación', () => {
    expect(isPickupDue('2026-06-17', now)).toBe(false);
  });

  it('se cierra una vez que el arriendo empezó', () => {
    expect(isPickupDue('2026-06-10', now)).toBe(false);
  });

  it('sin fecha de inicio no inventa una ventana', () => {
    expect(isPickupDue(null, now)).toBe(false);
  });
});

describe('buildAlerts', () => {
  it('avisa del retiro sin la reserva pagada', () => {
    const alerts = buildAlerts([order({ startDate: '2026-06-16', reservePaid: false })], now);
    expect(alerts.map(a => a.kind)).toContain('pickup-without-payment');
    expect(alerts[0]?.severity).toBe('crit');
  });

  it('no avisa de pago si el pedido ya está pagado completo', () => {
    const alerts = buildAlerts(
      [order({ startDate: '2026-06-16', reservePaid: false, fullyPaid: true })],
      now
    );
    expect(alerts.map(a => a.kind)).not.toContain('pickup-without-payment');
  });

  it('avisa del retiro sin contrato firmado', () => {
    const alerts = buildAlerts([order({ startDate: '2026-06-16', hasContract: false })], now);
    expect(alerts.map(a => a.kind)).toContain('pickup-without-contract');
  });

  it('levanta ambos bloqueos cuando faltan los dos', () => {
    // Son dos impedimentos distintos y se resuelven por vías distintas: colapsarlos en uno haría
    // que el admin arregle el pago y crea que ya puede entregar.
    const alerts = buildAlerts(
      [order({ startDate: '2026-06-16', reservePaid: false, hasContract: false })],
      now
    );
    expect(alerts).toHaveLength(2);
  });

  it('no avisa de retiro cuando la ventana todavía no se abre', () => {
    const alerts = buildAlerts(
      [order({ startDate: '2026-07-01', reservePaid: false, hasContract: false })],
      now
    );
    expect(alerts).toHaveLength(0);
  });

  it('avisa de la devolución atrasada, que es cobrable', () => {
    const alerts = buildAlerts([order({ startDate: '2026-06-01', endDate: '2026-06-10' })], now);
    expect(alerts.map(a => a.kind)).toContain('late-return');
  });

  it('avisa del saldo vencido', () => {
    const alerts = buildAlerts([order({ startDate: '2026-06-01', endDate: '2026-06-10' })], now);
    expect(alerts.map(a => a.kind)).toContain('overdue-payment');
  });

  it('un pedido cancelado no levanta nada: no queda operación que bloquear', () => {
    const alerts = buildAlerts(
      [
        order({
          status: 'cancelled',
          startDate: '2026-06-16',
          endDate: '2026-06-01',
          reservePaid: false,
          hasContract: false,
        }),
      ],
      now
    );
    expect(alerts).toHaveLength(0);
  });

  it('reconoce el cancelado en vocabulario legado', () => {
    const alerts = buildAlerts([order({ status: 'failed', startDate: '2026-06-16', reservePaid: false })], now);
    expect(alerts).toHaveLength(0);
  });

  it('ordena lo crítico antes que lo de advertencia', () => {
    const alerts = buildAlerts(
      [
        order({ id: 1, startDate: '2026-06-01', endDate: '2026-06-05' }),
        order({ id: 2, startDate: '2026-06-16', reservePaid: false }),
      ],
      now
    );
    expect(alerts[0]?.severity).toBe('crit');
  });

  it('un pedido en regla no aparece en la lista', () => {
    expect(buildAlerts([order()], now)).toHaveLength(0);
  });

  it('sin pedidos devuelve una lista vacía en vez de fallar', () => {
    expect(buildAlerts([], now)).toEqual([]);
  });
});
