import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * /inventory/ubicaciones hands the per-location unit counts to the plan. The counts fail soft on
 * their own: a missing count must not hide the map that did load.
 */
const page = readFileSync(
  fileURLToPath(new URL("../../../../pages/inventory/ubicaciones.astro", import.meta.url)),
  "utf8",
);

describe("/inventory/ubicaciones — unit counts per location", () => {
  it("loads the counts from WarehouseLocationService.countUnitsByLocation", () => {
    expect(page).toContain("WarehouseLocationService.countUnitsByLocation()");
  });

  it("passes the loaded counts to the dashboard instead of a hard-coded null", () => {
    expect(page).not.toMatch(/unitCounts=\{null\}/);
    expect(page).toMatch(/unitCounts=\{unitCounts\}/);
  });

  it("reads the counts in their own try/catch so a failure keeps the locations", () => {
    const countsCall = page.indexOf("countUnitsByLocation()");
    const listCall = page.indexOf("WarehouseLocationService.list(");
    expect(countsCall).toBeGreaterThan(-1);
    const between = page.slice(Math.min(countsCall, listCall), Math.max(countsCall, listCall));
    expect(between).toMatch(/catch/);
  });
});
