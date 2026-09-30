import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * D-21 (01e): the operational agenda must sit as a canonical side column ("Próximas
 * Operaciones") next to the main content — a two-column grid on desktop, stacked on mobile —
 * instead of full-width above the header. Source-level assertion (same pattern as
 * `theme-tokens.test.ts`): rendering `dashboard.astro` needs a live admin session and Supabase
 * data, out of scope for a unit test.
 */
const source = readFileSync(
  fileURLToPath(new URL("../dashboard.astro", import.meta.url)),
  "utf8",
);

describe("dashboard.astro layout (D-21, 01e)", () => {
  it("wraps the main content and the agenda in a two-column grid", () => {
    expect(source).toMatch(/class="[^"]*grid[^"]*lg:grid-cols-\[/);
  });

  it("renders DashboardContainer (main column) before OperationalAgenda (side column)", () => {
    const containerIndex = source.indexOf("<DashboardContainer");
    const agendaIndex = source.indexOf("<OperationalAgenda");
    expect(containerIndex).toBeGreaterThan(-1);
    expect(agendaIndex).toBeGreaterThan(-1);
    expect(containerIndex).toBeLessThan(agendaIndex);
  });

  it("no longer forces the agenda full-width above the header via mb-6 wrapper", () => {
    // Previous layout: `<div class="mb-6"><OperationalAgenda ... /></div>` sitting above
    // `<DashboardContainer>`, which held the canonical header.
    expect(source).not.toMatch(/class="mb-6">\s*<OperationalAgenda/);
  });
});
