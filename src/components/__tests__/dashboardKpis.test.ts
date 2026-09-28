import { describe, expect, it } from "vitest";
import { mapDashboardKpis, EMPTY_KPI_VALUE } from "../dashboardKpis";
import type { DashboardStats } from "../../services/dashboardService";
import { emptyStatusBuckets } from "../../lib/orderStatus";

function makeStats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    monthlyOrderStats: {
      totalOrders: 0,
      createdOrders: 0,
      byStatus: emptyStatusBuckets() as any,
    },
    operationalKpis: {
      retirosHoy: 0,
      entregasHoy: 0,
      devolucionesHoy: 0,
      pedidosActivos: 0,
    },
    ordersByStatus: emptyStatusBuckets(),
    rentedEquipment: [],
    financialSummary: {
      totalSales: 0,
      totalPaid: 0,
      totalPending: 0,
      reservationPayments: 0,
      finalPayments: 0,
    },
    ...overrides,
  };
}

describe("mapDashboardKpis", () => {
  it("returns the five D-04 canon KPIs, in canon order", () => {
    const items = mapDashboardKpis(makeStats());
    expect(items.map((i) => i.label)).toEqual([
      "Pedidos Activos",
      "Próximas Entregas",
      "Devoluciones Hoy",
      "Ingresos Mes",
      "Cobros Pendientes",
    ]);
  });

  it("maps Pedidos Activos, Próximas Entregas and Devoluciones Hoy straight from operationalKpis", () => {
    const items = mapDashboardKpis(
      makeStats({
        operationalKpis: {
          retirosHoy: 2,
          entregasHoy: 5,
          devolucionesHoy: 3,
          pedidosActivos: 12,
        },
      }),
    );
    expect(items.find((i) => i.key === "pedidosActivos")?.value).toBe("12");
    expect(items.find((i) => i.key === "proximasEntregas")?.value).toBe("5");
    expect(items.find((i) => i.key === "devolucionesHoy")?.value).toBe("3");
  });

  it("renders Ingresos Mes as an explicit empty state, never an invented number", () => {
    const items = mapDashboardKpis(
      makeStats({
        financialSummary: {
          totalSales: 999999,
          totalPaid: 0,
          totalPending: 0,
          reservationPayments: 0,
          finalPayments: 0,
        },
      }),
    );
    const ingresosMes = items.find((i) => i.key === "ingresosMes");
    expect(ingresosMes?.value).toBe(EMPTY_KPI_VALUE);
    expect(ingresosMes?.isEmpty).toBe(true);
  });

  it("formats Cobros Pendientes as rounded CLP with es-CL thousands separators", () => {
    const items = mapDashboardKpis(
      makeStats({
        financialSummary: {
          totalSales: 0,
          totalPaid: 0,
          totalPending: 1234567.8,
          reservationPayments: 0,
          finalPayments: 0,
        },
      }),
    );
    expect(items.find((i) => i.key === "cobrosPendientes")?.value).toBe(
      "$1.234.568",
    );
  });
});
