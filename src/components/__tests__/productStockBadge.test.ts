import { describe, expect, it } from "vitest";
import { productStockTone, productStockBadgeLabel } from "../productStockBadge";

describe("productStockTone", () => {
  it("maps instock to ok", () => {
    expect(productStockTone("instock")).toBe("ok");
  });

  it("maps outofstock to crit", () => {
    expect(productStockTone("outofstock")).toBe("crit");
  });

  it("maps onbackorder to warn", () => {
    expect(productStockTone("onbackorder")).toBe("warn");
  });

  it("falls back to neutral for an unrecognised or missing status", () => {
    expect(productStockTone("discontinued")).toBe("neutral");
    expect(productStockTone(null)).toBe("neutral");
    expect(productStockTone(undefined)).toBe("neutral");
  });
});

describe("productStockBadgeLabel", () => {
  it("returns the canon Spanish label for each known status", () => {
    expect(productStockBadgeLabel("instock")).toBe("Disponible");
    expect(productStockBadgeLabel("outofstock")).toBe("No disponible");
    expect(productStockBadgeLabel("onbackorder")).toBe("Bajo pedido");
  });

  it("defaults a missing status to the outofstock label", () => {
    expect(productStockBadgeLabel(null)).toBe("No disponible");
    expect(productStockBadgeLabel(undefined)).toBe("No disponible");
  });
});
