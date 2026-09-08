import { describe, expect, it } from 'vitest';
import { NAV_GROUPS, NAV_MODULES, activeModule, moduleByPath, visibleNavGroups } from '../navigation';

/**
 * La navegación de Área 01.
 *
 * El canónico (`Área 01 · Rental Técnico/OFF/*.html`, `<aside class="side">`, idéntico en los
 * ocho documentos) no es una lista plana: son TRES grupos rotulados — Torre de Control,
 * Operaciones Rental, Gestión del Negocio — y ocho módulos repartidos entre ellos. El dashboard
 * tenía siete entradas planas con otros nombres y otro orden.
 *
 * Se modela como dato y no como JSX porque este proyecto no tiene jsdom: así el orden, los
 * rótulos y la resolución de la ruta activa quedan verificados, que es donde están los errores
 * que nadie nota — un módulo que nunca se marca activo se ve como un enlace muerto.
 */
describe('NAV_GROUPS', () => {
  it('tiene los tres grupos del canónico, en orden', () => {
    expect(NAV_GROUPS.map(g => g.label)).toEqual([
      'Torre de Control',
      'Operaciones Rental',
      'Gestión del Negocio',
    ]);
  });

  it('reparte los módulos como el canónico', () => {
    expect(NAV_GROUPS[0]?.items.map(i => i.label)).toEqual(['Centro de Control', 'Alertas']);
    expect(NAV_GROUPS[1]?.items.map(i => i.label)).toEqual([
      'Pedidos',
      'Check-In / Devoluciones',
      'Delivery',
      'Catálogo Equipos',
      'Clientes & Documentos',
    ]);
    // Operarios (lote 3) es la única entrada fuera del canónico; sólo la ve super_admin.
    expect(NAV_GROUPS[2]?.items.map(i => i.label)).toEqual(['Finanzas & Cobranza', 'Rentabilidad', 'Operarios']);
  });

  it('no deja ningún módulo sin ruta ni con ruta duplicada', () => {
    const paths = NAV_MODULES.map(m => m.href);
    expect(paths.every(p => p.startsWith('/'))).toBe(true);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('cada módulo declara su icono', () => {
    // Un icono ausente no rompe el build: renderiza un hueco y la fila se desalinea.
    expect(NAV_MODULES.every(m => m.icon.length > 0)).toBe(true);
  });
});

/**
 * La ruta activa. El canónico marca el módulo actual con `aria-current="page"`, que es lo que
 * anuncia un lector de pantalla; el resaltado visual por sí solo no comunica nada.
 */
describe('activeModule', () => {
  it('reconoce la ruta exacta', () => {
    expect(activeModule('/orders')?.label).toBe('Pedidos');
    expect(activeModule('/dashboard')?.label).toBe('Centro de Control');
  });

  it('marca el módulo padre en una subruta', () => {
    // Estar en el detalle de un pedido sigue siendo estar en Pedidos.
    expect(activeModule('/orders/1234')?.label).toBe('Pedidos');
    expect(activeModule('/products/categories')?.label).toBe('Catálogo Equipos');
  });

  it('no confunde rutas con prefijo compartido', () => {
    // `/orders-archive` NO es una subruta de `/orders`; sin el separador el prefijo miente.
    expect(activeModule('/orders-archive')).toBeNull();
  });

  it('devuelve null en una ruta que ningún módulo cubre', () => {
    expect(activeModule('/login')).toBeNull();
    expect(activeModule('/')).toBeNull();
  });

  it('no marca la raíz como activa desde cualquier parte', () => {
    // Un `href` de `/` con match por prefijo marcaría TODOS los módulos a la vez.
    expect(NAV_MODULES.some(m => m.href === '/')).toBe(false);
  });
});

/**
 * Visibilidad por rol (lote 3). Esconder el enlace no protege la ruta — eso lo hace
 * `accessControl.ts` — pero un admin que ve "Operarios" y recibe 403 al abrirlo lee un bug.
 */
describe('visibleNavGroups', () => {
  it('un admin ve el canónico exacto: los ocho módulos, sin Operarios', () => {
    const groups = visibleNavGroups('admin');
    expect(groups.map(g => g.label)).toEqual(['Torre de Control', 'Operaciones Rental', 'Gestión del Negocio']);
    expect(groups[2]?.items.map(i => i.label)).toEqual(['Finanzas & Cobranza', 'Rentabilidad']);
    expect(groups.flatMap(g => g.items)).toHaveLength(9);
  });

  it('un super_admin ve además Operarios', () => {
    const groups = visibleNavGroups('super_admin');
    expect(groups[2]?.items.map(i => i.label)).toContain('Operarios');
  });

  it('un operator no ve ningún grupo: su shell no tiene barra lateral', () => {
    expect(visibleNavGroups('operator')).toEqual([]);
    expect(visibleNavGroups(null)).toEqual([]);
    expect(visibleNavGroups(undefined)).toEqual([]);
  });

  it('no devuelve grupos vacíos', () => {
    expect(visibleNavGroups('admin').every(g => g.items.length > 0)).toBe(true);
  });
});

describe('moduleByPath', () => {
  it('resuelve por ruta exacta y nada más', () => {
    expect(moduleByPath('/orders')?.label).toBe('Pedidos');
    expect(moduleByPath('/orders/1234')).toBeNull();
  });
});
