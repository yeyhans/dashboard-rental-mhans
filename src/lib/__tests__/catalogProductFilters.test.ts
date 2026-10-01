import { describe, expect, it } from "vitest";
import { filterCatalogProducts, uniqueBrands } from "../catalogProductFilters";
import type { Product } from "../../types/product";

function product(partial: Partial<Product> = {}): Product {
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

describe("uniqueBrands", () => {
  it("returns sorted, de-duplicated, non-empty brand names", () => {
    const products = [
      product({ brands: "Profoto" }),
      product({ brands: "Canon" }),
      product({ brands: "Profoto" }),
      product({ brands: null }),
      product({ brands: "  " }),
    ];
    expect(uniqueBrands(products)).toEqual(["Canon", "Profoto"]);
  });
});

describe("filterCatalogProducts", () => {
  const products = [
    product({
      id: 1,
      name: "Profoto B10",
      brands: "Profoto",
      categories_name: "Iluminación",
      stock_status: "instock",
    }),
    product({
      id: 2,
      name: "Canon R5",
      brands: "Canon",
      categories_name: "Cámaras",
      stock_status: "outofstock",
    }),
    product({
      id: 3,
      name: "Manfrotto 545B",
      brands: "Manfrotto",
      categories_name: "Soportes",
      stock_status: "onbackorder",
    }),
  ];

  it("returns every product when every filter is 'all' or empty", () => {
    expect(
      filterCatalogProducts(products, {
        search: "",
        category: "all",
        brand: "all",
        stockStatus: "all",
      }),
    ).toHaveLength(3);
  });

  it("filters by search term across name, sku and slug", () => {
    const result = filterCatalogProducts(products, { search: "canon" });
    expect(result.map((p) => p.id)).toEqual([2]);
  });

  it("filters by category name", () => {
    const result = filterCatalogProducts(products, { category: "Cámaras" });
    expect(result.map((p) => p.id)).toEqual([2]);
  });

  it("filters by exact brand", () => {
    const result = filterCatalogProducts(products, { brand: "Manfrotto" });
    expect(result.map((p) => p.id)).toEqual([3]);
  });

  it("filters by stock status", () => {
    const result = filterCatalogProducts(products, {
      stockStatus: "onbackorder",
    });
    expect(result.map((p) => p.id)).toEqual([3]);
  });

  it("combines every filter with AND semantics", () => {
    const result = filterCatalogProducts(products, {
      search: "canon",
      brand: "Canon",
      stockStatus: "outofstock",
    });
    expect(result.map((p) => p.id)).toEqual([2]);

    const none = filterCatalogProducts(products, {
      search: "canon",
      brand: "Profoto",
    });
    expect(none).toHaveLength(0);
  });
});
