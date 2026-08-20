import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Fila de KPIs de la pantalla canónica de Pedidos
 * (`Área 01 · Rental Técnico/OFF/MarioHans_OS_Area01_Pedidos_Canonical_RC2.1.2.html`, `.kpi-row`).
 *
 * El canónico trae los cuatro rótulos y a qué pestaña enlaza cada uno, pero sus valores son mock
 * estático (05 / 03 / 04 / 18) y no hay JS que los calcule. La semántica no se puede leer del
 * HTML, así que sale de las reglas operacionales de `.claude/rules/01-business-context.md`, que
 * sí son autoritativas para el negocio:
 *
 *   · "Retiro: día anterior al inicio del arriendo, 15:00–20:00"
 *   · "Devolución: hasta las 13:00 del día siguiente al término"
 *
 * De ahí, y de la pestaña a la que enlaza cada tarjeta:
 *
 *   Retiros Hoy      → `preparation` con inicio MAÑANA   (el retiro precede al arriendo en 1 día)
 *   Entregas Hoy     → inicio HOY                        (el equipo pasa a estar con el cliente)
 *   Devoluciones Hoy → término HOY
 *   Pedidos Activos  → todo lo no terminal               ("En operación")
 *
 * `today` se inyecta a propósito: un KPI que dependa del reloj del proceso es un test que falla
 * a medianoche y pasa el resto del día.
 */
const from = vi.fn();

vi.mock('../../lib/supabase', () => ({
  get supabaseAdmin() {
    return { from };
  },
}));

/** `.from().select().in().not().gte()` y variantes: devolvemos siempre el mismo set. */
function stubOrders(rows: Array<Record<string, unknown>>) {
  const thenable = {
    select: () => thenable,
    in: () => thenable,
    not: () => thenable,
    gte: () => thenable,
    lte: () => thenable,
    eq: () => thenable,
    order: () => thenable,
    limit: () => Promise.resolve({ data: rows, error: null }),
    then: (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null }),
  };
  from.mockReturnValue(thenable);
}

const HOY = new Date('2026-06-11T09:00:00-04:00');

function order(id: number, status: string, inicio: string, termino: string) {
  return {
    id,
    status,
    order_fecha_inicio: inicio,
    order_fecha_termino: termino,
    calculated_total: 1000,
  };
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('DashboardService.getOperationalKpis', () => {
  it('cuenta como retiro de hoy un pedido en preparación que arrienda mañana', async () => {
    stubOrders([
      order(1, 'preparation', '2026-06-12', '2026-06-14'), // retiro hoy
      order(2, 'preparation', '2026-06-13', '2026-06-15'), // retiro mañana, no hoy
      order(3, 'confirmed', '2026-06-12', '2026-06-14'), // arrienda mañana pero no está en bodega
    ]);
    const { DashboardService } = await import('../dashboardService');

    const kpis = await DashboardService.getOperationalKpis(HOY);

    expect(kpis.retirosHoy).toBe(1);
  });

  it('cuenta como entrega de hoy todo pedido cuyo arriendo empieza hoy', async () => {
    stubOrders([
      order(1, 'in-rental', '2026-06-11', '2026-06-13'),
      order(2, 'preparation', '2026-06-11', '2026-06-12'),
      order(3, 'in-rental', '2026-06-10', '2026-06-13'), // empezó ayer
    ]);
    const { DashboardService } = await import('../dashboardService');

    const kpis = await DashboardService.getOperationalKpis(HOY);

    expect(kpis.entregasHoy).toBe(2);
  });

  it('cuenta como devolución de hoy todo pedido cuyo término es hoy', async () => {
    stubOrders([
      order(1, 'in-rental', '2026-06-09', '2026-06-11'),
      order(2, 'return', '2026-06-08', '2026-06-11'),
      order(3, 'in-rental', '2026-06-09', '2026-06-12'),
    ]);
    const { DashboardService } = await import('../dashboardService');

    const kpis = await DashboardService.getOperationalKpis(HOY);

    expect(kpis.devolucionesHoy).toBe(2);
  });

  it('cuenta como activo todo pedido que no está en un estado terminal', async () => {
    stubOrders([
      order(1, 'request', '2026-06-20', '2026-06-22'),
      order(2, 'in-rental', '2026-06-09', '2026-06-13'),
      order(3, 'completed', '2026-05-01', '2026-05-03'),
      order(4, 'cancelled', '2026-05-01', '2026-05-03'),
    ]);
    const { DashboardService } = await import('../dashboardService');

    const kpis = await DashboardService.getOperationalKpis(HOY);

    expect(kpis.pedidosActivos).toBe(2);
  });

  it('pliega el vocabulario legado antes de contar', async () => {
    // Durante la ventana hay filas con `on-hold` y `processing`. Un KPI que solo mire los ocho
    // valores v1.2 marcaría cero mientras el negocio opera con normalidad.
    stubOrders([
      order(1, 'on-hold', '2026-06-20', '2026-06-22'), // → request, activo
      order(2, 'processing', '2026-06-11', '2026-06-13'), // → confirmed, activo y entrega hoy
      order(3, 'failed', '2026-06-11', '2026-06-13'), // → cancelled, no activo
    ]);
    const { DashboardService } = await import('../dashboardService');

    const kpis = await DashboardService.getOperationalKpis(HOY);

    expect(kpis.pedidosActivos).toBe(2);
    expect(kpis.entregasHoy).toBe(1);
  });

  it('no cuenta pedidos cancelados en ninguna tarjeta', async () => {
    stubOrders([order(1, 'cancelled', '2026-06-11', '2026-06-11')]);
    const { DashboardService } = await import('../dashboardService');

    const kpis = await DashboardService.getOperationalKpis(HOY);

    expect(kpis).toEqual({
      retirosHoy: 0,
      entregasHoy: 0,
      devolucionesHoy: 0,
      pedidosActivos: 0,
    });
  });

  it('tolera fechas nulas sin caerse', async () => {
    stubOrders([{ id: 1, status: 'request', order_fecha_inicio: null, order_fecha_termino: null }]);
    const { DashboardService } = await import('../dashboardService');

    const kpis = await DashboardService.getOperationalKpis(HOY);

    expect(kpis.pedidosActivos).toBe(1);
    expect(kpis.entregasHoy).toBe(0);
  });
});
