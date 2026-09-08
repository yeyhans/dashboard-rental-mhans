import { describe, expect, it } from 'vitest';
import { expandStatusFilter } from '../orderStatus';

/**
 * El filtro de estados del tablero.
 *
 * `DashboardFilters` deja al admin marcar varios estados; `/api/dashboard/filtered` los recibía
 * y usaba **solo el primero** (`status?.length > 0 ? status[0] : undefined`), con un comentario
 * "por ahora". Marcar tres estados devolvía las órdenes de uno: el tablero mostraba menos de lo
 * pedido sin decir nada.
 *
 * Encima, ese único valor iba a un `.eq('status', x)` literal. Durante la ventana de migración
 * las filas todavía llevan el vocabulario legado, así que filtrar por `request` — la traducción
 * de `on-hold` — no devuelve ninguna: cero resultados con HTTP 200.
 *
 * `expandStatusFilter` traduce lo que el admin marcó a la lista completa que hay que buscar en
 * la tabla: el valor canónico más sus equivalentes legados que aún puedan existir.
 */
describe('expandStatusFilter', () => {
  it('sin selección devuelve null: no se filtra por estado', () => {
    expect(expandStatusFilter([])).toBeNull();
    expect(expandStatusFilter(undefined)).toBeNull();
  });

  it('conserva todos los estados marcados, no solo el primero', () => {
    const resultado = expandStatusFilter(['confirmed', 'in-rental', 'completed']);
    expect(resultado).toContain('confirmed');
    expect(resultado).toContain('in-rental');
    expect(resultado).toContain('completed');
  });

  it('agrega el equivalente legado para que la ventana de migración no devuelva cero', () => {
    expect(expandStatusFilter(['request'])).toEqual(expect.arrayContaining(['request', 'on-hold']));
    expect(expandStatusFilter(['confirmed'])).toEqual(expect.arrayContaining(['confirmed', 'processing']));
  });

  it('no duplica los slugs que ambos vocabularios comparten', () => {
    const resultado = expandStatusFilter(['completed', 'cancelled']);
    expect(resultado).toEqual([...new Set(resultado)]);
  });

  it('acepta un valor legado marcado directamente y le suma su canónico', () => {
    expect(expandStatusFilter(['on-hold'])).toEqual(expect.arrayContaining(['on-hold', 'request']));
  });

  it('descarta lo que ningún vocabulario define en vez de mandarlo a la consulta', () => {
    expect(expandStatusFilter(['paid', 'inventado'])).toBeNull();
    expect(expandStatusFilter(['completed', 'paid'])).toEqual(['completed']);
  });
});
