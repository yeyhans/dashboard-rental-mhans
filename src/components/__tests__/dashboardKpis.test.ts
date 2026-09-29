import { describe, expect, it } from "vitest";
import {
  mapDashboardKpis,
  EMPTY_KPI_VALUE,
  isUnfilteredDashboardQuery,
} from "../dashboardKpis";
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
      "Entregas Hoy",
      "Devoluciones Hoy",
      "Ingresos Mes",
      "Cobros Pendientes",
    ]);
  });

  it("labels the deliveries KPI honestly as 'Entregas Hoy' (D-14d): its value is entregasHoy, not a real upcoming-deliveries count", () => {
    const items = mapDashboardKpis(makeStats());
    const proximasEntregas = items.find((i) => i.key === "proximasEntregas");
    expect(proximasEntregas?.label).toBe("Entregas Hoy");
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

  it("uses the unfiltered total pending override for Cobros Pendientes when given (D-14c), ignoring the period-filtered financialSummary.totalPending", () => {
    const items = mapDashboardKpis(
      makeStats({
        financialSummary: {
          totalSales: 0,
          totalPaid: 0,
          totalPending: 500, // period-filtered value (e.g. "last month")
          reservationPayments: 0,
          finalPayments: 0,
        },
      }),
      999000, // unfiltered, company-wide total pending
    );
    expect(items.find((i) => i.key === "cobrosPendientes")?.value).toBe(
      "$999.000",
    );
  });

  it("falls back to financialSummary.totalPending when no override is given", () => {
    const items = mapDashboardKpis(
      makeStats({
        financialSummary: {
          totalSales: 0,
          totalPaid: 0,
          totalPending: 500,
          reservationPayments: 0,
          finalPayments: 0,
        },
      }),
    );
    expect(items.find((i) => i.key === "cobrosPendientes")?.value).toBe("$500");
  });
});

/**
 * D-18: Centro de Control caches `totalPendingUnfiltered` from the mount-time load and never
 * touches it again — even when the user later applies "todo el período" with no other filter,
 * which is the one query whose `totalPending` is genuinely company-wide. This decides when a
 * `handleFiltersChange` load is unfiltered enough to refresh that cache: any status, financial or
 * search scoping (or a bounded date period) means the load is NOT the company-wide figure and
 * must leave the cached value alone.
 */
describe("isUnfilteredDashboardQuery", () => {
  function makeFilters(
    overrides: Partial<Parameters<typeof isUnfilteredDashboardQuery>[0]> = {},
  ) {
    return {
      dateRange: { period: "all" as const },
      status: [] as string[],
      financialStatus: "all" as const,
      searchTerm: "",
      ...overrides,
    };
  }

  it("is true for the fully unfiltered query: period all, no status/financial/search filter", () => {
    expect(isUnfilteredDashboardQuery(makeFilters())).toBe(true);
  });

  it("is false when the period is scoped (e.g. monthly, the mount-time default)", () => {
    expect(
      isUnfilteredDashboardQuery(
        makeFilters({ dateRange: { period: "monthly" } }),
      ),
    ).toBe(false);
  });

  it("is false when a status filter is applied", () => {
    expect(
      isUnfilteredDashboardQuery(makeFilters({ status: ["completed"] })),
    ).toBe(false);
  });

  it("is false when a financial status filter is applied", () => {
    expect(
      isUnfilteredDashboardQuery(makeFilters({ financialStatus: "pending" })),
    ).toBe(false);
  });

  it("is false when a non-blank search term is present", () => {
    expect(isUnfilteredDashboardQuery(makeFilters({ searchTerm: "ana" }))).toBe(
      false,
    );
  });

  it("is true for a whitespace-only search term, same as the row-matching logic treats it", () => {
    expect(isUnfilteredDashboardQuery(makeFilters({ searchTerm: "   " }))).toBe(
      true,
    );
  });
});
