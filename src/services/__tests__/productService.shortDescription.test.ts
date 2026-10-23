import { afterEach, describe, expect, it, vi } from "vitest";

import { callArgs, sharedDouble as db } from "./supabaseDouble";

vi.mock("../../lib/supabase", async () => {
  const { sharedDouble } = await import("./supabaseDouble");
  return { supabaseAdmin: sharedDouble.client };
});

const { ProductService } = await import("../productService");

afterEach(() => {
  db.reset();
  vi.restoreAllMocks();
});

/**
 * `short_description` is plain text everywhere (the client site renders it as text). The service
 * normalizes it before persisting, so no API caller can store HTML in that column.
 */
describe("ProductService short_description normalization", () => {
  it("stores plain text when creating a product with HTML in short_description", async () => {
    db.queue("products", { data: { id: 1 }, error: null });

    await ProductService.createProduct({
      name: "Softbox",
      slug: "softbox",
      short_description: "<p>Softbox <strong>Profoto</strong> &amp; grilla</p>",
      description: "<p>Larga <em>con</em> HTML</p>",
    } as never);

    const [query] = db.buildersFor("products");
    const [rows] = callArgs(query, "insert") as [
      Array<Record<string, unknown>>,
    ];
    expect(rows[0].short_description).toBe("Softbox Profoto & grilla");
    expect(rows[0].description).toBe("<p>Larga <em>con</em> HTML</p>");
  });

  it("stores plain text when updating short_description", async () => {
    db.queue("products", { data: { id: 42 }, error: null });

    await ProductService.updateProduct(42, {
      short_description: "<ul><li>a</li><li>b</li></ul>",
    });

    const [query] = db.buildersFor("products");
    expect(callArgs(query, "update")).toEqual([{ short_description: "a b" }]);
  });

  it("keeps literal angle brackets that are not HTML tags", async () => {
    db.queue("products", { data: { id: 42 }, error: null });

    await ProductService.updateProduct(42, {
      short_description: "Lente 24-70 & filtro <ND>",
    });

    const [query] = db.buildersFor("products");
    expect(callArgs(query, "update")).toEqual([
      { short_description: "Lente 24-70 & filtro <ND>" },
    ]);
  });

  it("stores null when short_description is empty after normalization", async () => {
    db.queue("products", { data: { id: 42 }, error: null });

    await ProductService.updateProduct(42, { short_description: "<p>  </p>" });

    const [query] = db.buildersFor("products");
    expect(callArgs(query, "update")).toEqual([{ short_description: null }]);
  });

  it("does not add short_description to an update that does not include it", async () => {
    db.queue("products", { data: { id: 42 }, error: null });

    await ProductService.updateProduct(42, { name: "Nuevo" });

    const [query] = db.buildersFor("products");
    expect(callArgs(query, "update")).toEqual([{ name: "Nuevo" }]);
  });
});
