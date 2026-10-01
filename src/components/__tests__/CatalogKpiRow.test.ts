import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * D-23 (05d): the canon "Mantención / Bloqueadas" KPI label (with a circular icon, canon
 * pattern P7) instead of the plain "Bloqueados" label this Astro component rendered before.
 * Source-level assertions because this component needs a live admin session + Supabase data to
 * render through Astro's SSR pipeline — out of scope for a unit test here, same reasoning as
 * `Base.test.ts`.
 */
const source = readFileSync(
  fileURLToPath(new URL("../CatalogKpiRow.astro", import.meta.url)),
  "utf8",
);

describe("CatalogKpiRow.astro (D-23, 05d)", () => {
  it("labels the incidents KPI 'Mantención / Bloqueadas', not 'Bloqueados'", () => {
    expect(source).toMatch(/Mantención\s*\/\s*Bloqueadas/);
    expect(source).not.toMatch(/>\s*Bloqueados\s*</);
  });

  it("renders every KPI through the shared KpiCard (circular icon, canon P7)", () => {
    expect(source).toContain('from "./shared/KpiCard"');
    expect(source.match(/<KpiCard/g) || []).toHaveLength(4);
  });
});
