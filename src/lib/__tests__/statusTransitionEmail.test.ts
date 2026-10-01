import { describe, expect, it } from 'vitest';
import { emailOnTransition, enteredStatus } from '../orderStatus';

/**
 * Qué correo dispara un cambio de estado.
 *
 * `EditOrderForm` decidía con cuatro literales — `order.status === 'completed'`,
 * `formData.status === 'failed'` — y el mismo par se repite en `orderNotificationService` y en
 * `ProcessOrder`. Después de 0003 `failed` no vuelve a existir: la comparación es siempre falsa y
 * **el correo de disculpas deja de enviarse** sin registrar nada. El cliente queda sin aviso de
 * que su pedido se cayó.
 *
 * `enteredStatus` responde la pregunta real: ¿este guardado hace ENTRAR el pedido a esta etapa?
 * Normaliza ambos lados, así que una fila legada que pasa a su equivalente v1.2 no cuenta como
 * entrada — durante la ventana, guardar `on-hold` como `request` no debe reenviar el correo de
 * solicitud recibida.
 */
describe('enteredStatus', () => {
  it('detecta la entrada a una etapa', () => {
    expect(enteredStatus('confirmed', 'in-rental', 'in-rental')).toBe(true);
  });

  it('no dispara si el pedido ya estaba en esa etapa', () => {
    expect(enteredStatus('completed', 'completed', 'completed')).toBe(false);
  });

  it('no dispara al normalizar una fila legada al mismo estado canónico', () => {
    // `on-hold` y `request` son la misma etapa escrita en dos vocabularios.
    expect(enteredStatus('on-hold', 'request', 'request')).toBe(false);
    expect(enteredStatus('processing', 'confirmed', 'confirmed')).toBe(false);
  });

  it('reconoce el estado destino escrito en vocabulario legado', () => {
    // `failed` y `refunded` son ambos la salida terminal `cancelled`.
    expect(enteredStatus('processing', 'failed', 'cancelled')).toBe(true);
    expect(enteredStatus('processing', 'refunded', 'cancelled')).toBe(true);
  });

  it('no dispara cuando el destino no es la etapa preguntada', () => {
    expect(enteredStatus('request', 'evaluation', 'completed')).toBe(false);
  });

  it('trata un origen irreconocible como "no estaba ahí"', () => {
    // Un pedido con un estado que ningún vocabulario define sí puede entrar a una etapa válida.
    expect(enteredStatus('paid', 'completed', 'completed')).toBe(true);
  });
});

/**
 * `emailOnTransition` combina lo anterior con `EMAIL_ON_ENTER`, la tabla de los correos del
 * handoff. Un solo lugar decide, en vez de un `if` por endpoint.
 */
describe('emailOnTransition', () => {
  it('devuelve la plantilla de la etapa a la que entra', () => {
    expect(emailOnTransition('confirmed', 'in-rental')).toBe('equipos-entregados');
    expect(emailOnTransition('preparation', 'completed')).toBe('pedido-completado');
  });

  it('mapea el fallo legado al correo de la salida terminal', () => {
    // Esto es lo que se rompía: `failed` ya no existe, pero el correo de disculpas sigue debiendo salir.
    expect(emailOnTransition('processing', 'failed')).toBe('equipos-no-disponibles');
  });

  it('no manda nada en las etapas internas de bodega', () => {
    expect(emailOnTransition('evaluation', 'confirmed')).toBeNull();
    expect(emailOnTransition('confirmed', 'preparation')).toBeNull();
    expect(emailOnTransition('in-rental', 'return')).toBeNull();
  });

  it('no reenvía cuando el estado no cambió de etapa', () => {
    expect(emailOnTransition('completed', 'completed')).toBeNull();
    expect(emailOnTransition('on-hold', 'request')).toBeNull();
  });

  it('no manda nada si el destino es irreconocible', () => {
    expect(emailOnTransition('request', 'paid')).toBeNull();
  });
});
