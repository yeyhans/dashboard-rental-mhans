import { describe, expect, it } from "vitest";
import {
  computeOrderListKpis,
  matchesOrderListTab,
  filterOrdersByTab,
  orderListTabCounts,
  toBadgeTone,
} from "../orderListMetrics";

const HOY = new Date("2026-06-11T09:00:00-04:00");

function order(status: string, inicio: string, termino: string) {
  return { status, order_fecha_inicio: inicio, order_fecha_termino: termino };
}

describe("computeOrderListKpis", () => {
  it("cuenta como retiro de hoy un pedido en preparación que arrienda mañana", () => {
    const kpis = computeOrderListKpis(
      [
        order("preparation", "2026-06-12", "2026-06-14"),
        order("preparation", "2026-06-13", "2026-06-15"),
        order("confirmed", "2026-06-12", "2026-06-14"),
      ],
      HOY,
    );
    expect(kpis.retirosHoy).toBe(1);
  });

  it("cuenta como entrega de hoy todo pedido cuyo arriendo empieza hoy", () => {
    const kpis = computeOrderListKpis(
      [
        order("in-rental", "2026-06-11", "2026-06-13"),
        order("preparation", "2026-06-11", "2026-06-12"),
        order("in-rental", "2026-06-10", "2026-06-13"),
      ],
      HOY,
    );
    expect(kpis.entregasHoy).toBe(2);
  });

  it("cuenta como devolución de hoy todo pedido cuyo término es hoy", () => {
    const kpis = computeOrderListKpis(
      [
        order("in-rental", "2026-06-09", "2026-06-11"),
        order("return", "2026-06-08", "2026-06-11"),
        order("in-rental", "2026-06-09", "2026-06-12"),
      ],
      HOY,
    );
    expect(kpis.devolucionesHoy).toBe(2);
  });

  it("cuenta como activo todo pedido que no está en un estado terminal", () => {
    const kpis = computeOrderListKpis(
      [
        order("request", "2026-06-20", "2026-06-22"),
        order("in-rental", "2026-06-09", "2026-06-13"),
        order("completed", "2026-05-01", "2026-05-03"),
        order("cancelled", "2026-05-01", "2026-05-03"),
      ],
      HOY,
    );
    expect(kpis.pedidosActivos).toBe(2);
  });
});

describe("matchesOrderListTab", () => {
  it("matches a single-status tab exactly", () => {
    expect(matchesOrderListTab("confirmed", "confirmed")).toBe(true);
    expect(matchesOrderListTab("request", "confirmed")).toBe(false);
  });

  it("todos matches every status except cancelled", () => {
    expect(matchesOrderListTab("completed", "todos")).toBe(true);
    expect(matchesOrderListTab("request", "todos")).toBe(true);
    expect(matchesOrderListTab("cancelled", "todos")).toBe(false);
  });

  it("resolves legacy statuses to their v1.2 tab", () => {
    expect(matchesOrderListTab("on-hold", "request")).toBe(true);
  });

  it("returns false for an unrecognised tab", () => {
    expect(matchesOrderListTab("confirmed", "bogus")).toBe(false);
  });
});

describe("filterOrdersByTab", () => {
  it("keeps only the orders matching the tab", () => {
    const orders = [
      { id: 1, status: "request" },
      { id: 2, status: "confirmed" },
      { id: 3, status: "cancelled" },
    ];
    expect(filterOrdersByTab(orders, "todos").map((o) => o.id)).toEqual([1, 2]);
    expect(filterOrdersByTab(orders, "confirmed").map((o) => o.id)).toEqual([
      2,
    ]);
  });
});

describe("toBadgeTone", () => {
  it("passes through the five tones StatusBadge understands", () => {
    expect(toBadgeTone("confirmed")).toBe("ok");
    expect(toBadgeTone("evaluation")).toBe("warn");
    expect(toBadgeTone("in-rental")).toBe("info");
    expect(toBadgeTone("request")).toBe("neutral");
  });

  it("folds the muted cancelled tone back to neutral", () => {
    expect(toBadgeTone("cancelled")).toBe("neutral");
  });
});

describe("orderListTabCounts", () => {
  it("counts orders per tab, todos excluding cancelled", () => {
    const orders = [
      order("request", "2026-06-01", "2026-06-02"),
      order("request", "2026-06-01", "2026-06-02"),
      order("confirmed", "2026-06-01", "2026-06-02"),
      order("cancelled", "2026-06-01", "2026-06-02"),
    ];
    const counts = orderListTabCounts(orders);
    expect(counts.todos).toBe(3);
    expect(counts.request).toBe(2);
    expect(counts.confirmed).toBe(1);
  });
});
