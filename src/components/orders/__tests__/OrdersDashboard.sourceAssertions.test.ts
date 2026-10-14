import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * D-22 (02c/02d/02g): source-level assertions over `OrdersDashboard.tsx`. This project has no
 * jsdom/testing-library (see `vitest.config.ts`), and these checks are about which class names
 * and strings the component emits — a `renderToStaticMarkup` string-contains test would assert
 * the exact same thing with more setup, so the source is read directly instead.
 */
const source = readFileSync(
  path.resolve(__dirname, "../OrdersDashboard.tsx"),
  "utf-8",
);

/** RC2.1.2 T2: the table markup lives in the presentational `OrdersTable.tsx`. */
const readOptional = (relative: string) => {
  const file = path.resolve(__dirname, relative);
  return existsSync(file) ? readFileSync(file, "utf-8") : "";
};
const tableSource = readOptional("../OrdersTable.tsx");
const tailwindConfig = readOptional("../../../../tailwind.config.mjs");
const globalsCss = readOptional("../../../styles/globals.css");

describe("OrdersDashboard — source assertions (D-22)", () => {
  it("does not color the Inicio/Término date cells green/red (02d)", () => {
    expect(source).not.toContain("text-green-600");
    expect(source).not.toContain("text-red-600");
  });

  it("formats the Inicio/Término dates with the shared weekday helper (02d)", () => {
    // RC2.1.2 T2: the date cells live in the presentational OrdersTable.
    expect(tableSource).toContain("formatOrderDateWithWeekday");
    expect(tableSource).not.toContain("text-green-600");
    expect(tableSource).not.toContain("text-red-600");
  });

  it('keeps "Registrar Devolución" next to "Nuevo Pedido" (02c)', () => {
    expect(source).toContain("Registrar Devolución");
    expect(source).toContain('href="/check-in"');
  });

  it("does not style the budget PDF icon with off-palette Tailwind blue (02g)", () => {
    expect(source).not.toContain("bg-blue-200");
    expect(source).not.toContain("text-blue-900");
  });
});

describe("OrdersDashboard — canon pass (02.1-02.5)", () => {
  const returned = source.slice(source.lastIndexOf("  return (\n    <div"));

  it("renders the title as an uppercase H1 through PageHeader with the total (02.2)", () => {
    expect(source).toContain('from "../shared/PageHeader"');
    expect(returned).toMatch(/<PageHeader[\s\S]*title="Pedidos"/);
    // Canon RC2.1.2: date and total share one subtitle line ("fecha · N pedidos en sistema").
    expect(returned).not.toMatch(/<PageHeader[^>]*date=\{/);
    // T-19 (a): the header total uses the Todos tab basis, not the raw row count.
    expect(returned).toMatch(/<PageHeader[\s\S]*\{tabCounts\.todos\}/);
    expect(returned).not.toContain("<CardTitle");
  });

  it("places the page header before the KPI row (02.1)", () => {
    expect(returned.indexOf("<PageHeader")).toBeGreaterThan(-1);
    expect(returned.indexOf("<PageHeader")).toBeLessThan(
      returned.indexOf("<KpiCard"),
    );
  });

  it("underlines the status tabs on a single row with a pill counter (02.3)", () => {
    const tabsBlock = returned.slice(
      returned.indexOf("<Tabs "),
      returned.indexOf("</Tabs>"),
    );
    expect(tabsBlock).not.toContain("flex-wrap");
    expect(tabsBlock).toContain("border-b-2");
    expect(tabsBlock).toContain("rounded-full");
    expect(tabsBlock).not.toMatch(/\(\{tabCounts\[tab\.value\]\}\)/);
  });

  it("adds the Productos column fed by the shared line-items summary (02.4)", () => {
    expect(tableSource).toContain("summarizeOrderProducts");
    expect(tableSource).toMatch(/>\s*Productos\s*<\/th>/);
  });

  it("keeps the Acciones column reachable: sticky actions cell (02.4)", () => {
    expect(tableSource).toContain("sticky right-0");
  });

  it("never lets the date cells wrap onto extra lines (02.5)", () => {
    expect(tableSource).toMatch(/whitespace-nowrap/);
    expect(tableSource).toMatch(/Inicio\{" "\}/);
    expect(tableSource).toMatch(/Término\{" "\}/);
    expect(tableSource).not.toContain("Inicio:");
    expect(tableSource).not.toContain("Término:");
  });
});

describe("OrdersDashboard — mobile pass (D-25)", () => {
  it("hides the empty 'Proyecto' label on the mobile card instead of showing a blank value", () => {
    // RC2.1.2 T3: the card is the same table restyled by CSS; an empty cell drops its label.
    expect(globalsCss).toMatch(
      /\.orders-table td:empty\s*\{\s*display:\s*none/,
    );
    expect(tableSource).toMatch(/order\.order_proyecto \?\? ""/);
  });

  it("pairs 'Registrar Devolución' and 'Nuevo Pedido' at equal width on mobile, inside the header actions", () => {
    const actionsBlock = source.slice(
      source.indexOf("actions={"),
      source.indexOf("<KpiCard"),
    );
    expect(actionsBlock).toContain("grid w-full grid-cols-2 gap-2 sm:flex");
    expect(actionsBlock).toMatch(/Registrar Devolución[\s\S]*<CreateOrderForm/);
  });

  it("keeps each mobile card value right-aligned beside its label, even without Proyecto (D-27)", () => {
    expect(globalsCss).toMatch(
      /\.orders-table td\s*\{[^}]*justify-content:\s*space-between[^}]*text-align:\s*right/,
    );
  });
});

describe("OrdersTable — table fits at 1440 px (T-16, canon RC2.1.2)", () => {
  const header = tableSource.slice(
    tableSource.indexOf("<thead"),
    tableSource.indexOf("</thead>"),
  );

  it("merges Neto, IVA and Total into a single Monto column", () => {
    expect(header).toMatch(/>\s*Monto\s*<\/th>/);
    expect(header).not.toMatch(/>\s*Neto\s*<\/th>/);
    expect(header).not.toMatch(/>\s*IVA\s*<\/th>/);
    expect(header).not.toMatch(/>\s*Total\s*<\/th>/);
  });

  it("renders the Total on top and 'IVA · Neto' in the canon 10px faint line below", () => {
    const body = tableSource.slice(tableSource.indexOf("<tbody"));
    const totalAt = body.indexOf("order.calculated_total");
    const ivaAt = body.indexOf("order.calculated_iva");
    const netAt = body.indexOf("order.calculated_subtotal");
    expect(totalAt).toBeGreaterThan(-1);
    expect(totalAt).toBeLessThan(ivaAt);
    expect(ivaAt).toBeLessThan(netAt);
    expect(body).toMatch(/text-\[10px\][^"]*"[\s\S]{0,200}IVA \$/);
    expect(body).toContain("· Neto $");
  });

  it("keeps the header to the 8 canon columns with the actions column pinned right", () => {
    expect((header.match(/<th\b/g) ?? []).length).toBe(8);
    expect(header).toMatch(/sticky right-0[^>]*>\s*Acciones/);
    expect(header).not.toMatch(/>\s*Estado\s*<\/th>/);
  });
});

describe("OrdersDashboard — table extracted to OrdersTable (RC2.1.2 T2)", () => {
  it("renders the desktop list through the presentational OrdersTable", () => {
    expect(source).toContain('from "./OrdersTable"');
    expect(source).toMatch(/<OrdersTable[\s\S]*onChangeStatus=/);
    expect(source).not.toContain('from "../ui/table"');
  });

  it("opens ProcessOrder from one controlled dialog, not a dialog per row", () => {
    expect((source.match(/<Dialog\b/g) ?? []).length).toBe(1);
    expect(source).toMatch(/<Dialog[^>]*open=\{isDialogOpen\}/);
    expect(source).toContain("<ProcessOrder");
  });

  it("maps Tailwind's font-mono to the canon JetBrains Mono stack", () => {
    expect(tailwindConfig).toMatch(/mono:\s*\[\s*"var\(--font-mono\)"/);
    expect(tailwindConfig).toMatch(/sans:\s*\[\s*"var\(--font-ui\)"/);
  });
});

describe("OrdersDashboard — header total matches the Todos tab (T-19a)", () => {
  it("counts the header total on the same basis as the Todos tab", () => {
    expect(source).toMatch(/\$\{tabCounts\.todos\} pedidos en sistema/);
  });
});

describe("OrdersDashboard — canon header, KPIs and tabs (RC2.1.2 T1)", () => {
  const returned = source.slice(source.lastIndexOf("  return (\n    <div"));
  const header = returned.slice(
    returned.indexOf("<PageHeader"),
    returned.indexOf("<KpiCard"),
  );

  it("puts the secondary 'Registrar Devolución' and the primary 'Nuevo Pedido' in the header actions slot", () => {
    expect(header).toContain("actions={");
    expect(header).toContain('href="/check-in"');
    expect(header).toMatch(/variant="outline"[\s\S]*Registrar Devolución/);
    expect(header).toContain("<CreateOrderForm");
    // No anchor wrapping a button: the link itself is the control.
    expect(header).not.toMatch(/<a href="\/check-in"[^>]*>\s*<Button/);
  });

  it("renders the four KPIs with the canon variant, a meta line and a tab target", () => {
    const kpis = returned.match(/<KpiCard[\s\S]*?\/>/g) ?? [];
    expect(kpis).toHaveLength(4);
    for (const kpi of kpis) {
      expect(kpi).toContain('variant="canon"');
      expect(kpi).toContain("meta=");
      expect(kpi).toContain("ORDER_LIST_KPI_TABS.");
    }
  });

  it("lays the KPIs out 4 per row, 2 per row up to 900px", () => {
    expect(returned).toContain(
      "grid grid-cols-2 gap-3 min-[901px]:grid-cols-4",
    );
  });

  it("shows each tab count in a mono pill that turns black when active", () => {
    const tabsBlock = returned.slice(
      returned.indexOf("<Tabs "),
      returned.indexOf("</Tabs>"),
    );
    expect(tabsBlock).toContain("font-mono");
    expect(tabsBlock).toContain("group-data-[state=active]:bg-foreground");
    expect(tabsBlock).toContain("group-data-[state=active]:text-background");
  });
});

describe("OrdersDashboard — responsive cards, search row, pagination and states (RC2.1.2 T3)", () => {
  it("switches to cards with CSS at 768px instead of a JS isMobileView branch", () => {
    expect(source).not.toContain("isMobileView");
    expect(source).not.toContain("window.innerWidth");
    expect(globalsCss).toContain("@media (max-width: 768px)");
    expect(globalsCss).toMatch(
      /\.orders-table td\[data-label\]::before\s*\{[^}]*content:\s*attr\(data-label\)/,
    );
    expect(globalsCss).toMatch(/\.orders-table thead\s*\{\s*display:\s*none/);
  });

  it("drops the filter Card wrapper and the off-palette green PDF button", () => {
    expect(source).not.toContain('from "../ui/card"');
    expect(source).not.toContain("<Card");
    expect(source).not.toContain("bg-green-200");
  });

  it("renders the canon search row: search box up to 340px, delivery filter and Actualizar", () => {
    const searchRow = source.slice(
      source.indexOf("canon .search-row"),
      source.indexOf("{renderOrderItems()}"),
    );
    expect(searchRow).toContain("max-w-[340px]");
    expect(searchRow).toContain(
      'placeholder="Buscar pedido, cliente o proyecto…"',
    );
    expect(searchRow).toContain('id="shipping"');
    expect(searchRow).toContain("Actualizar");
  });

  it("orders the list like the canon: tabs, then search row, then table, then pagination", () => {
    const tabs = source.indexOf("<Tabs ");
    const search = source.indexOf("canon .search-row");
    const table = source.indexOf("renderOrderItems()");
    const pagination = source.indexOf("<OrdersPagination");
    expect(tabs).toBeGreaterThan(-1);
    expect(tabs).toBeLessThan(search);
    expect(search).toBeLessThan(table);
    expect(table).toBeLessThan(pagination);
  });

  it("shows Loader2 while refreshing and an empty state with an action", () => {
    expect(source).toContain("Loader2");
    expect(source).not.toContain("border-r-transparent");
    expect(source).toContain("Limpiar filtros");
    expect(source).toMatch(/emptyState[\s\S]*<CreateOrderForm/);
  });
});
