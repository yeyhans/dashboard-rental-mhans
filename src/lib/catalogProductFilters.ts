import type { Product } from "../types/product";

/**
 * D-23 (05e): client-side filters over the product list the page already loaded (no new
 * endpoint) — category, brand and stock state, composed with the existing free-text search.
 */
export interface CatalogProductFilters {
  search?: string;
  category?: string;
  brand?: string;
  stockStatus?: string;
}

/** Distinct, non-empty, alphabetically sorted brand names for the brand filter's options. */
export function uniqueBrands(products: readonly Product[]): string[] {
  const set = new Set<string>();
  for (const product of products) {
    const brand = product.brands?.trim();
    if (brand) set.add(brand);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function isAllOrEmpty(value: string | undefined): boolean {
  return !value || value === "all";
}

export function matchesCatalogFilters(
  product: Product,
  filters: CatalogProductFilters,
): boolean {
  const search = filters.search?.trim().toLowerCase() ?? "";
  const matchesSearch =
    !search ||
    (product.name?.toLowerCase().includes(search) ?? false) ||
    (product.sku?.toLowerCase().includes(search) ?? false) ||
    (product.slug?.toLowerCase().includes(search) ?? false);

  const matchesCategory =
    isAllOrEmpty(filters.category) ||
    (product.categories_name?.includes(filters.category!) ?? false);

  const matchesBrand =
    isAllOrEmpty(filters.brand) || product.brands?.trim() === filters.brand;

  const matchesStockStatus =
    isAllOrEmpty(filters.stockStatus) ||
    (product.stock_status ?? "outofstock") === filters.stockStatus;

  return matchesSearch && matchesCategory && matchesBrand && matchesStockStatus;
}

export function filterCatalogProducts(
  products: readonly Product[],
  filters: CatalogProductFilters,
): Product[] {
  return products.filter((product) => matchesCatalogFilters(product, filters));
}
