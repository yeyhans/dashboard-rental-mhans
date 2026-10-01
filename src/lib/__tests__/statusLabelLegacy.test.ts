import { describe, expect, it } from 'vitest';
import { LEGACY_ORDER_STATUSES, statusLabel } from '../orderStatus';

/**
 * El rótulo de una fila legada.
 *
 * `statusLabel` sólo consultaba `STATUS_LABELS`, que tiene las ocho claves v1.2, y devolvía el
 * valor crudo para todo lo demás. Durante la ventana de migración eso significa que cada pedido
 * todavía sin migrar se muestra como `on-hold` o `processing` — el slug en inglés, en pantalla,
 * al admin. Y como `getOrderStatusInSpanish` (los PDF) ahora delega aquí, el presupuesto emitido
 * saldría con el slug donde antes decía "En Espera".
 *
 * El rótulo correcto es el de la ETAPA CANÓNICA: una fila `on-hold` está en la etapa Solicitud,
 * aunque la columna todavía no se haya reescrito.
 */
describe('statusLabel con vocabulario legado', () => {
  it('traduce cada estado legado al rótulo de su etapa canónica', () => {
    expect(statusLabel('on-hold')).toBe('Solicitud');
    expect(statusLabel('pending')).toBe('Solicitud');
    expect(statusLabel('processing')).toBe('Confirmado');
    expect(statusLabel('failed')).toBe('Cancelado');
    expect(statusLabel('refunded')).toBe('Cancelado');
  });

  it('no deja ningún estado legado sin rótulo en español', () => {
    for (const legacy of LEGACY_ORDER_STATUSES) {
      expect(statusLabel(legacy)).not.toBe(legacy);
    }
  });

  it('devuelve el valor tal cual si ningún vocabulario lo define', () => {
    // Preferible a inventar un rótulo: deja visible que llegó algo que no debería existir.
    expect(statusLabel('paid')).toBe('paid');
  });
});
