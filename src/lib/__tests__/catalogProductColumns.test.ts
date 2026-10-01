import { describe, expect, it } from "vitest";
import {
  CATALOG_UNAVAILABLE_COLUMN_VALUE,
  productBrandSkuLine,
} from "../catalogProductColumns";

describe("CATALOG_UNAVAILABLE_COLUMN_VALUE", () => {
  it("is the canonical em-dash placeholder", () => {
    expect(CATALOG_UNAVAILABLE_COLUMN_VALUE).toBe("—");
  });
});

describe("productBrandSkuLine", () => {
  it("joins brand and SKU when both exist", () => {
    expect(productBrandSkuLine({ brands: "Profoto", sku: "PB-10" })).toBe(
      "Profoto · SKU PB-10",
    );
  });

  it("returns only the brand when SKU is missing", () => {
    expect(productBrandSkuLine({ brands: "Profoto", sku: null })).toBe(
      "Profoto",
    );
  });

  it("returns only the SKU when brand is missing", () => {
    expect(productBrandSkuLine({ brands: null, sku: "PB-10" })).toBe(
      "SKU PB-10",
    );
  });

  it("returns an empty string when neither exists", () => {
    expect(productBrandSkuLine({ brands: null, sku: null })).toBe("");
  });

  it("trims whitespace-only values as absent", () => {
    expect(productBrandSkuLine({ brands: "  ", sku: "  " })).toBe("");
  });
});
