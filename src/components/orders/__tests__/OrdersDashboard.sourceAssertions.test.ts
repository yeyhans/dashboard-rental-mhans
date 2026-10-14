import { readFileSync } from "node:fs";
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

describe("OrdersDashboard — source assertions (D-22)", () => {
  it("does not color the Inicio/Término date cells green/red (02d)", () => {
    expect(source).not.toContain("text-green-600");
    expect(source).not.toContain("text-red-600");
  });

  it("formats the Inicio/Término dates with the shared weekday helper (02d)", () => {
    expect(source).toContain("formatOrderDateWithWeekday");
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
    expect(source).toContain("summarizeOrderProducts");
    expect(source).toMatch(/>\s*Productos\s*<\/TableHead>/);
  });

  it("keeps the Acciones column reachable: sticky actions cell and compact padding (02.4)", () => {
    const desktop = source.slice(
      source.indexOf("// Desktop view - Table layout"),
    );
    expect(desktop).toContain("sticky right-0");
    expect(desktop).not.toContain('<div className="border overflow-hidden">');
  });

  it("never lets the date cells wrap onto extra lines (02.5)", () => {
    const desktop = source.slice(
      source.indexOf("// Desktop view - Table layout"),
    );
    expect(desktop).toMatch(/whitespace-nowrap/);
    expect(desktop).toMatch(/Inicio\{" "\}/);
    expect(desktop).toMatch(/Término\{" "\}/);
    expect(desktop).not.toContain("Inicio:");
    expect(desktop).not.toContain("Término:");
  });
});

describe("OrdersDashboard — mobile pass (D-25)", () => {
  it("hides the empty 'Proyecto' label on the mobile card instead of showing a blank value", () => {
    const mobileCardBlock = source.slice(
      source.indexOf("if (isMobileView) {"),
      source.indexOf("// Desktop view - Table layout"),
    );
    expect(mobileCardBlock).toMatch(/order\.order_proyecto\s*&&/);
  });

  it("pairs 'Registrar Devolución' and 'Nuevo Pedido' at equal width on mobile, inside the header actions", () => {
    const actionsBlock = source.slice(
      source.indexOf("actions={"),
      source.indexOf("<KpiCard"),
    );
    expect(actionsBlock).toContain("grid w-full grid-cols-2 gap-2 sm:flex");
    expect(actionsBlock).toMatch(/Registrar Devolución[\s\S]*<CreateOrderForm/);
  });

  it("keeps the mobile card's Total pinned to the right column even without Proyecto (D-27 R3-orders-total-shifts-left-without-proyecto)", () => {
    const mobileCardBlock = source.slice(
      source.indexOf("if (isMobileView) {"),
      source.indexOf("// Desktop view - Table layout"),
    );
    expect(mobileCardBlock).toMatch(/className="text-right col-start-2"/);
  });
});

describe("OrdersDashboard — table fits at 1440 px (T-16)", () => {
  const desktop = source.slice(
    source.indexOf("// Desktop view - Table layout"),
  );
  const header = desktop.slice(
    desktop.indexOf("<TableHeader>"),
    desktop.indexOf("</TableHeader>"),
  );

  it("merges Neto, IVA and Total into a single Monto column", () => {
    expect(header).toMatch(/>\s*Monto\s*<\/TableHead>/);
    expect(header).not.toMatch(/>\s*Neto\s*<\/TableHead>/);
    expect(header).not.toMatch(/>\s*IVA\s*<\/TableHead>/);
    expect(header).not.toMatch(/>\s*Total\s*<\/TableHead>/);
  });

  it("renders the Total on top and 'IVA · Neto' in small mono text below", () => {
    const body = desktop.slice(desktop.indexOf("<TableBody>"));
    const totalAt = body.indexOf("order.calculated_total");
    const ivaAt = body.indexOf("order.calculated_iva");
    const netAt = body.indexOf("order.calculated_subtotal");
    expect(totalAt).toBeGreaterThan(-1);
    expect(totalAt).toBeLessThan(ivaAt);
    expect(ivaAt).toBeLessThan(netAt);
    expect(body).toMatch(/font-mono text-xs[^"]*"[\s\S]{0,200}IVA \$/);
    expect(body).toContain("· Neto $");
  });

  it("keeps the header to 9 columns with the actions column pinned right", () => {
    expect((header.match(/<TableHead\b/g) ?? []).length).toBe(9);
    expect(header).toMatch(/sticky right-0[^"]*">\s*Acciones/);
  });
});

describe("OrdersDashboard — header total matches the Todos tab (T-19a)", () => {
  it("counts the header total on the same basis as the Todos tab", () => {
    expect(source).toMatch(/\$\{tabCounts\.todos\} pedidos en sistema/);
    expect(source).toMatch(/\(\{tabCounts\.todos\} total\)/);
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
