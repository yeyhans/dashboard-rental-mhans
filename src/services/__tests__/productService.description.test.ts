import { afterEach, describe, expect, it, vi } from "vitest";

import { allCallArgs, callArgs, sharedDouble as db } from "./supabaseDouble";

vi.mock("../../lib/supabase", async () => {
  const { sharedDouble } = await import("./supabaseDouble");
  return { supabaseAdmin: sharedDouble.client };
});

const { ProductService } = await import("../productService");

afterEach(() => {
  db.reset();
  vi.restoreAllMocks();
});

describe("ProductService.updateDescription", () => {
  it("reduces short_description to plain text and trims description before writing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.queue("products", { data: { id: 16 }, error: null });

    await ProductService.updateDescription(16, {
      short_description: "<p>Cámara <b>full frame</b></p>",
      description: "  Detalle largo  ",
    });

    const [update] = db.buildersFor("products");
    expect(callArgs(update, "update")).toEqual([
      { short_description: "Cámara full frame", description: "Detalle largo" },
    ]);
    expect(allCallArgs(update, "eq")).toEqual([["id", 16]]);
  });

  it("writes only the fields that were provided", async () => {
    db.queue("products", { data: { id: 16 }, error: null });

    await ProductService.updateDescription(16, { description: "Solo larga" });

    const [update] = db.buildersFor("products");
    expect(callArgs(update, "update")).toEqual([{ description: "Solo larga" }]);
  });

  it("returns null when the product does not exist", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.queue("products", {
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });

    await expect(
      ProductService.updateDescription(999, { description: "x" }),
    ).resolves.toBeNull();
  });
});
