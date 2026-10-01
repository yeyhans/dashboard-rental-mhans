import { describe, expect, it } from 'vitest';
import { ORDER_STATUSES, canonicalStatus, isBudgetStatus } from '../orderStatus';

/**
 * La compuerta de generación de presupuestos.
 *
 * `budgetGenerationService.validateOrderForBudget` exigía literalmente
 * `if (order.status !== 'on-hold')`. Después de 0003 ninguna orden vuelve a estar en `on-hold`,
 * así que esa condición es siempre verdadera y **el sistema deja de generar presupuestos**. No
 * lanza ni registra un fallo: devuelve "falta cumplir un requisito" y el admin ve un botón que
 * no hace nada.
 *
 * El mismo literal aparecía en `CreateOrderForm`, que dispara la generación automática al crear
 * una orden comparando la respuesta del endpoint contra `'on-hold'`. Ese caso se volvió urgente
 * al normalizar `POST /api/orders`: el endpoint ahora responde `request`, así que la comparación
 * ya no se cumple ni siquiera antes de aplicar la migración.
 *
 * El presupuesto pertenece a la etapa inicial del pedido: `request` es la traducción directa de
 * `on-hold`, y `evaluation` es donde Área 01 sitúa la acción "genera presupuesto versionado".
 */
describe('isBudgetStatus', () => {
  it('acepta la etapa que reemplaza a on-hold', () => {
    expect(isBudgetStatus('request')).toBe(true);
  });

  it('acepta evaluation, donde Área 01 sitúa el presupuesto versionado', () => {
    expect(isBudgetStatus('evaluation')).toBe(true);
  });

  it('sigue aceptando on-hold mientras la ventana tenga filas legadas', () => {
    // Entre el despliegue y el apply conviven ambos vocabularios. Si la compuerta dejara de
    // reconocer `on-hold`, los presupuestos se caerían durante la ventana en vez de después.
    expect(isBudgetStatus('on-hold')).toBe(true);
    expect(isBudgetStatus('pending')).toBe(true);
  });

  it('rechaza las etapas donde el presupuesto ya no corresponde', () => {
    for (const status of ['confirmed', 'preparation', 'in-rental', 'return', 'completed', 'cancelled']) {
      expect(isBudgetStatus(status)).toBe(false);
    }
  });

  it('rechaza un valor que ningún vocabulario define', () => {
    expect(isBudgetStatus('paid')).toBe(false);
    expect(isBudgetStatus('')).toBe(false);
  });

  it('coincide con canonicalStatus: todo lo que acepta se normaliza a request o evaluation', () => {
    const aceptados = [...ORDER_STATUSES, 'on-hold', 'pending', 'processing', 'failed']
      .filter(isBudgetStatus)
      .map(canonicalStatus);

    expect(new Set(aceptados)).toEqual(new Set(['request', 'evaluation']));
  });
});
