import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ProductsDashboard from "../../ProductsDashboard";
import type { Product } from "../../../types/product";

/**
 * D-8 (revisiones cliente oct, 05.1 / 05.3 / 05.4): KPI strip below the page header, SKU and
 * Estado as their own columns, and a toolbar that wraps instead of cropping the view toggle.
 */
const source = readFileSync(
  fileURLToPath(new URL("../../ProductsDashboard.tsx", import.meta.url)),
  "utf8",
);
const page = readFileSync(
  fileURLToPath(
    new URL("../../../pages/products/index.astro", import.meta.url),
  ),
  "utf8",
);

function makeProduct(partial: Partial<Product> = {}): Product {
  return {
    id: 1,
    name: "Profoto B10",
    slug: "profoto-b10",
    type: "simple",
    status: "publish",
    featured: false,
    catalog_visibility: "visible",
    description: null,
    short_description: null,
    sku: "PB-10",
    price: 30000,
    regular_price: 30000,
    sale_price: null,
    on_sale: false,
    total_sales: 0,
    sold_individually: false,
    related_ids: null,
    stock_status: "instock",
    brands: "Profoto",
    dimensions_length: null,
    dimensions_width: null,
    dimensions_height: null,
    seo_title: null,
    seo_description: null,
    seo_keywords: null,
    primary_term_product_cat: null,
    images: null,
    categories_ids: null,
    categories_name: "Iluminación",
    tags: null,
    collage_image_url: null,
    declared_quantity: null,
    market_value_clp: null,
    used_value_clp: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...partial,
  };
}

function render(children?: React.ReactNode) {
  return renderToStaticMarkup(
    <ProductsDashboard
      initialProducts={[makeProduct()]}
      initialTotal={1}
      initialCategories={[]}
      accessToken="token"
    >
      {children}
    </ProductsDashboard>,
  );
}

describe("ProductsDashboard — KPI strip placement (05.1)", () => {
  it("renders slotted children between the page header and the filters card", () => {
    const html = render(<div data-testid="kpi-slot">KPI-SLOT</div>);
    const header = html.indexOf("Catálogo de Equipos");
    const kpi = html.indexOf("KPI-SLOT");
    const filters = html.indexOf("Buscar productos");
    expect(header).toBeGreaterThanOrEqual(0);
    expect(kpi).toBeGreaterThan(header);
    expect(filters).toBeGreaterThan(kpi);
  });

  // T3 (0021): the unit-based InventoryKpiRow replaces CatalogKpiRow when the counts load; the
  // older strip stays as the fallback. Either way the strip is a child, not above the header.
  it("the catalog page hands the KPI strip to ProductsDashboard as a child, not above it", () => {
    const children = page.match(/<ProductsDashboard[\s\S]*?>([\s\S]*?)<\/ProductsDashboard>/)?.[1] ?? "";
    expect(children).toMatch(/<InventoryKpiRow[^>]*\/>/);
    expect(children).toMatch(/<CatalogKpiRow[^>]*\/>/);
    expect(page.indexOf("<CatalogKpiRow")).toBeGreaterThan(page.indexOf("<ProductsDashboard"));
    expect(page.indexOf("<InventoryKpiRow")).toBeGreaterThan(page.indexOf("<ProductsDashboard"));
  });
});

describe("ProductsDashboard — SKU and Estado columns (05.3)", () => {
  it("has SKU and Estado as table column headers", () => {
    const html = render();
    expect(html).toMatch(/<th[^>]*>\s*SKU/);
    expect(html).toMatch(/<th[^>]*>\s*Estado/);
    // T3 (0021): "Stock" is back as the unit-count column, after Estado (the stock_status
    // badge keeps the Estado header and its sort).
    expect(html.indexOf(">Stock</th>")).toBeGreaterThan(html.search(/<th[^>]*>\s*Estado/));
  });

  it("renders the SKU in its own monospaced cell", () => {
    const html = render();
    expect(html).toMatch(/<td[^>]*font-mono[^>]*>\s*PB-10\s*<\/td>/);
  });

  it("keeps the brand under the name but no longer repeats the SKU there", () => {
    const html = render();
    expect(html).not.toContain("SKU PB-10");
    expect(html).toContain("Profoto");
  });
});

describe("ProductsDashboard — toolbar does not crop the view toggle (05.4)", () => {
  it("lets the filter controls wrap", () => {
    expect(render()).toMatch(/class="flex flex-wrap gap-2"/);
  });

  it("keeps the view toggle from shrinking", () => {
    expect(render()).toMatch(
      /class="[^"]*shrink-0[^"]*"[^>]*><button[^>]*aria-label="Vista de lista"/,
    );
    expect(source).toContain("shrink-0");
  });
});
