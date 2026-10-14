import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Product } from "../../../types/product";
import type { ProductUnitCounts } from "../../../types/inventory";

/**
 * T3 (0021): the catalog table shows Stock | Disp. | Arriendo | Inventario from real units through
 * `useProductUnitCounts` + `ProductUnitCountCells`. Without counts (not loaded yet, or the view is
 * missing) every one of those cells keeps the explicit placeholder, never a fabricated 0.
 */
const hook = vi.hoisted(() => ({
  state: { counts: null as Map<number, ProductUnitCounts> | null, error: null as string | null },
  calls: [] as Array<{ ids: readonly number[]; token: string | undefined }>,
}));

vi.mock("../useProductUnitCounts", () => ({
  useProductUnitCounts: (ids: readonly number[], token?: string) => {
    hook.calls.push({ ids, token });
    return hook.state;
  },
}));

const { default: ProductsDashboard } = await import("../../ProductsDashboard");

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

function counts(partial: Partial<ProductUnitCounts>): ProductUnitCounts {
  return { product_id: 1, total: 0, available: 0, in_rental: 0, maintenance: 0, damaged: 0, blocked: 0, retired: 0, ...partial };
}

function render(products: Product[] = [makeProduct()]) {
  return renderToStaticMarkup(
    <ProductsDashboard initialProducts={products} initialTotal={products.length} initialCategories={[]} accessToken="token" />,
  );
}

function headers(html: string): string[] {
  return [...html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((match) => match[1]!.replace(/<[^>]+>/g, "").trim());
}

function firstRowCells(html: string): string[] {
  const body = html.slice(html.indexOf("<tbody"));
  const row = body.match(/<tr[^>]*>([\s\S]*?)<\/tr>/)?.[1] ?? "";
  return [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) => match[1]!);
}

afterEach(() => {
  hook.state = { counts: null, error: null };
  hook.calls.length = 0;
});

describe("ProductsDashboard — unit count columns (T3, 0021)", () => {
  it("adds Stock, Disp., Arriendo and Inventario headers between Estado and Precio/día", () => {
    const names = headers(render());
    const estado = names.indexOf("Estado");
    expect(names.slice(estado + 1, estado + 5)).toEqual(["Stock", "Disp.", "Arriendo", "Inventario"]);
    expect(names[estado + 5]).toBe("Precio/día");
  });

  it("asks the hook for the counts of the loaded products with the session token", () => {
    render([makeProduct({ id: 4 }), makeProduct({ id: 9, name: "Canon R5", sku: "CR5" })]);
    expect(hook.calls.at(-1)).toEqual({ ids: [4, 9], token: "token" });
  });

  it("renders the real counts and the status pill when they are loaded", () => {
    hook.state = { counts: new Map([[1, counts({ total: 5, available: 3, in_rental: 2 })]]), error: null };
    const cells = firstRowCells(render());
    // Equipo, SKU, Ubicación, Estado, then the four unit cells.
    expect(cells.slice(4, 7)).toEqual(["5", "3", "2"]);
    expect(cells[7]).toContain("Disponible");
  });

  it("keeps the placeholder in the four unit cells when counts are missing", () => {
    hook.state = { counts: null, error: "No pudimos cargar el stock por unidad" };
    const cells = firstRowCells(render());
    expect(cells.slice(4, 8)).toEqual(["—", "—", "—", "—"]);
  });

  it("keeps the placeholder for a product absent from a loaded map", () => {
    hook.state = { counts: new Map([[99, counts({ product_id: 99, total: 1 })]]), error: null };
    const cells = firstRowCells(render());
    expect(cells.slice(4, 8)).toEqual(["—", "—", "—", "—"]);
  });
});
