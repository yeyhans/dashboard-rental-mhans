import type { Product } from "../types/product";

/**
 * D-23 (05b): the canon Catálogo table has Ubicación, Disp. and Arriendo columns that this
 * schema cannot answer per row today — `products` has no location column, and there is no
 * serialised-unit table to derive a per-product available/rented split from (the only real
 * cross exists as the aggregate KPI strip in `CatalogService.getAvailabilityKpis`, not per row).
 * Rendering a fabricated number would be worse than an explicit placeholder, so every caller
 * uses this one constant instead of a literal "—" scattered across the table and the grid view.
 */
export const CATALOG_UNAVAILABLE_COLUMN_VALUE = "—";

/**
 * Secondary line under the product name in the canon "Equipo" column: brand and SKU together
 * when both exist, either alone when only one does, or an empty string when neither does (the
 * caller decides whether to render anything for that row).
 */
export function productBrandSkuLine(
  product: Pick<Product, "brands" | "sku">,
): string {
  const brand = product.brands?.trim();
  const sku = product.sku?.trim();

  if (brand && sku) return `${brand} · SKU ${sku}`;
  if (brand) return brand;
  if (sku) return `SKU ${sku}`;
  return "";
}
