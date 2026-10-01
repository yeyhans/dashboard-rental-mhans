import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ProductsDashboard from "../ProductsDashboard";
import type { Product } from "../../types/product";

// Radix's `Select.Value` only resolves its displayed text (placeholder or selected item label)
// from a ref registered on mount — `renderToStaticMarkup` never commits, so no Select in this
// tree ever shows its text here (true for the pre-existing category filter too, not just these
// two). Their `placeholder` prop is asserted at the source level instead, same pattern as
// `OrdersDashboard.sourceAssertions.test.ts`.
const source = readFileSync(
  fileURLToPath(new URL("../ProductsDashboard.tsx", import.meta.url)),
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

function render() {
  return renderToStaticMarkup(
    <ProductsDashboard
      initialProducts={[makeProduct()]}
      initialTotal={1}
      initialCategories={[]}
      accessToken="token"
    />,
  );
}

describe("ProductsDashboard table (D-23, 05b)", () => {
  it("does not render Slug or Categorías as table column headers", () => {
    const html = render();
    expect(html).not.toMatch(/<th[^>]*>\s*Slug/i);
    expect(html).not.toMatch(/Categorías<\/th/i);
  });

  it("renders the canon Ubicación, Disp. and Arriendo columns with the explicit placeholder", () => {
    const html = render();
    expect(html).toContain("Ubicación");
    expect(html).toContain("Disp.");
    expect(html).toContain("Arriendo");
    // Placeholder appears at least for the three unanswerable columns of the one seeded row.
    expect((html.match(/—/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it("renders the Stock badge without allowing it to wrap", () => {
    const html = render();
    expect(html).toMatch(/whitespace-nowrap/);
  });
});

describe("ProductsDashboard row actions (D-23)", () => {
  it("replaces the 'Ver detalles' button and trash icon with the shared ⋮ menu", () => {
    const html = render();
    expect(html).not.toContain("Ver detalles");
    expect(html).toMatch(/aria-label="Más acciones"/);
  });
});

describe("ProductsDashboard filters and view toggle (D-23, 05e)", () => {
  it("declares a brand filter and a stock-state filter", () => {
    expect(source).toContain("Todas las marcas");
    expect(source).toContain("Todos los estados");
    expect(source).toContain("uniqueBrands");
    expect(source).toContain("brandFilter");
    expect(source).toContain("stockStatusFilter");
  });

  it("renders the list/grid view toggle with accessible pressed state", () => {
    const html = render();
    expect(html).toMatch(/aria-label="Vista de lista"/);
    expect(html).toMatch(/aria-label="Vista de tarjetas"/);
    expect(html).toMatch(/aria-pressed="true"/);
  });
});
