import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  OrdersTable,
  buildOrderRowActions,
  formatJornadas,
  type OrdersTableRow,
} from "../OrdersTable";

/**
 * Rendered with `react-dom/server` (no jsdom / testing-library in this project). The Radix menu
 * content is portalled and closed by default, so the menu items are covered through
 * `buildOrderRowActions`, the pure function the menu renders.
 */
function row(overrides: Partial<OrdersTableRow> = {}): OrdersTableRow {
  return {
    id: 1234,
    status: "confirmed",
    customer_id: 7,
    date_created: "2026-06-01T10:00:00Z",
    billing_first_name: "Ana",
    billing_last_name: "Pérez",
    billing_email: "ana@example.com",
    order_proyecto: "Campaña Otoño",
    order_fecha_inicio: "2026-06-12",
    order_fecha_termino: "2026-06-14",
    num_jornadas: 3,
    calculated_total: 119000,
    calculated_iva: 19000,
    calculated_subtotal: 100000,
    line_items: [{ name: "Profoto B10", quantity: 1 }],
    new_pdf_on_hold_url: "",
    new_pdf_processing_url: "",
    ...overrides,
  };
}

const html = renderToStaticMarkup(
  <OrdersTable orders={[row()]} onChangeStatus={() => {}} />,
);

describe("OrdersTable — canon columns (RC2.1.2 .tbl)", () => {
  it("renders the eight canon headers in order, with no separate Estado column", () => {
    const headers = [...html.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map(
      (m) => m[1],
    );
    expect(headers).toEqual([
      "Nº Pedido",
      "Cliente",
      "Proyecto",
      "Inicio · Término",
      "Jornadas",
      "Monto",
      "Productos",
      "Acciones",
    ]);
  });

  it("styles the header cells in 10px uppercase mono on the soft surface", () => {
    expect(html).toMatch(
      /<th[^>]*class="[^"]*font-mono[^"]*text-\[10px\][^"]*uppercase/,
    );
    expect(html).toContain("bg-[var(--color-surface-soft)]");
  });

  it("wraps the table in a bordered radius-10 frame, not a card", () => {
    expect(html).toMatch(/^<div class="[^"]*rounded-\[10px\][^"]*border/);
  });

  it("stacks the canon status badge under the order number", () => {
    const firstCell = html.slice(html.indexOf("<td"), html.indexOf("</td>"));
    expect(firstCell).toContain("#1234");
    expect(firstCell).toContain("Confirmado");
    expect(firstCell).toContain("uppercase");
    expect(firstCell.indexOf("1234")).toBeLessThan(
      firstCell.indexOf("Confirmado"),
    );
  });

  it("shows client name over a 10px email", () => {
    expect(html).toContain("Ana Pérez");
    expect(html).toMatch(/text-\[10px\][^"]*"[^>]*>ana@example\.com/);
  });

  it("shows Jornadas as 'N días' and the amount as total over 'IVA · Neto'", () => {
    expect(html).toContain("3 días");
    expect(html).toContain("$119.000");
    expect(html).toContain("IVA $19.000 · Neto $100.000");
  });

  it("keeps today's product summary in Productos", () => {
    expect(html).toContain("Profoto B10");
  });

  it("puts the end date on a faint second line", () => {
    expect(html).toMatch(
      /text-\[var\(--color-text-faint\)\][^"]*"[^>]*>Término /,
    );
  });

  it("exposes a single labelled ⋯ actions trigger per row", () => {
    expect(html).toContain('aria-label="Acciones del pedido 1234"');
    expect(html.match(/aria-label="Acciones del pedido/g)).toHaveLength(1);
  });

  it("labels every body cell for the mobile card layout", () => {
    for (const label of [
      "Nº Pedido",
      "Cliente",
      "Proyecto",
      "Fechas",
      "Jornadas",
      "Monto",
      "Productos",
    ]) {
      expect(html).toContain(`data-label="${label}"`);
    }
  });

  it("does not use the off-palette green for PDF actions", () => {
    expect(html).not.toContain("bg-green-200");
  });
});

describe("formatJornadas", () => {
  it("pluralises the day count like the canon", () => {
    expect(formatJornadas(1)).toBe("1 día");
    expect(formatJornadas("4")).toBe("4 días");
  });

  it("renders nothing for a missing or invalid count", () => {
    expect(formatJornadas(null)).toBe("");
    expect(formatJornadas(undefined)).toBe("");
    expect(formatJornadas("")).toBe("");
    expect(formatJornadas("abc")).toBe("");
  });
});

describe("buildOrderRowActions", () => {
  const handlers = () => ({
    onView: vi.fn(),
    onChangeStatus: vi.fn(),
    onOpenUrl: vi.fn(),
  });

  it("always offers Ver pedido and Cambiar estado", () => {
    const h = handlers();
    const actions = buildOrderRowActions(row(), h);
    expect(actions.map((a) => a.label)).toEqual([
      "Ver pedido",
      "Cambiar estado",
    ]);
    actions[0]!.onSelect();
    actions[1]!.onSelect();
    expect(h.onView).toHaveBeenCalledOnce();
    expect(h.onChangeStatus).toHaveBeenCalledOnce();
  });

  it("lists the latest budget first, then each older version, then the processing PDF", () => {
    const h = handlers();
    const actions = buildOrderRowActions(
      row({
        new_pdf_on_hold_url: "https://r2/a.pdf, https://r2/b.pdf,",
        new_pdf_processing_url: "https://r2/p.pdf",
      }),
      h,
    );
    expect(actions.map((a) => a.label)).toEqual([
      "Ver pedido",
      "Cambiar estado",
      "Presupuesto (v2, más reciente)",
      "Presupuesto v1",
      "Orden de proceso",
    ]);
    expect(actions.slice(2).every((a) => a.group === "documents")).toBe(true);
    actions[2]!.onSelect();
    actions[3]!.onSelect();
    actions[4]!.onSelect();
    expect(h.onOpenUrl.mock.calls).toEqual([
      ["https://r2/b.pdf"],
      ["https://r2/a.pdf"],
      ["https://r2/p.pdf"],
    ]);
  });

  it("labels a single budget without a version number", () => {
    const actions = buildOrderRowActions(
      row({ new_pdf_on_hold_url: "https://r2/a.pdf" }),
      handlers(),
    );
    expect(actions.map((a) => a.label)).toContain("Presupuesto");
  });
});
