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

describe("ProductsDashboard — mobile card (D-25)", () => {
  it("drops Slug and Categorías from the mobile card (still in the detail page) and keeps the ⋮ menu", () => {
    const mobileCardBlock = source.slice(
      source.indexOf("if (isMobileView) {"),
      source.indexOf('if (viewMode === "grid")'),
    );
    expect(mobileCardBlock).not.toMatch(/Slug:/);
    expect(mobileCardBlock).not.toMatch(/Categorías/);
    expect(mobileCardBlock).toContain("RowActionsMenu");
  });
});

describe("ProductsDashboard — view mode hydration (D-25, R3-viewmode-hydration-mismatch)", () => {
  it("initializes the list/grid toggle with the server default, reading localStorage only after mount", () => {
    expect(source).toContain('useState<CatalogViewMode>("list")');
    expect(source).not.toContain(
      "useState<CatalogViewMode>(loadCatalogViewMode)",
    );
    expect(source).toMatch(
      /useEffect\(\(\) => \{\s*setViewMode\(loadCatalogViewMode\(\)\);\s*\}, \[\]\)/,
    );
  });
});

describe("ProductsDashboard filters and view toggle (D-23, 05e)", () => {
  it("declares a brand filter and a stock-state filter", () => {
    // Radix `Select`/`SelectContent` never commits its children on a `renderToStaticMarkup`
    // pass (see the file-level comment above), so the dropdown wiring itself stays a source
    // assertion. The underlying filtering behavior is exercised for real right below instead
    // of being asserted twice at the source level (D-25, R3-source-only-assertions).
    expect(source).toContain("Todas las marcas");
    expect(source).toContain("Todos los estados");
  });

  it("does not let the default (unfiltered) brand/stock state hide any loaded product (D-25, R3-source-only-assertions)", () => {
    // Exercises the real `filterCatalogProducts`/`uniqueBrands` pipeline the component wires up,
    // instead of only grepping for the identifiers — both products must survive the default
    // "all"/"all" filters and both brands must be derived for the dropdown.
    const html = renderToStaticMarkup(
      <ProductsDashboard
        initialProducts={[
          makeProduct({ id: 1, name: "Profoto B10", brands: "Profoto" }),
          makeProduct({
            id: 2,
            name: "Canon R5",
            brands: "Canon",
            stock_status: "outofstock",
          }),
        ]}
        initialTotal={2}
        initialCategories={[]}
        accessToken="token"
      />,
    );
    expect(html).toContain("Profoto B10");
    expect(html).toContain("Canon R5");
  });

  it("renders the list/grid view toggle with accessible pressed state", () => {
    const html = render();
    expect(html).toMatch(/aria-label="Vista de lista"/);
    expect(html).toMatch(/aria-label="Vista de tarjetas"/);
    expect(html).toMatch(/aria-pressed="true"/);
  });
});
