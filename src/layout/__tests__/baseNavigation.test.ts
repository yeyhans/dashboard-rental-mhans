import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "../Base.astro"), "utf8");

describe("sidebar sublinks", () => {
  it("links the warehouse map from the products module", () => {
    expect(source).toMatch(/label: 'Ubicaciones', href: '\/inventory\/ubicaciones', icon: MapPin/);
  });
});
