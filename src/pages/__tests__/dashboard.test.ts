import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * D-6 (revisiones cliente oct, 01.2): the operational agenda sits in the wide left column with
 * per-order chips, and "Próximas Operaciones" is the right column, built from the same agenda
 * payload already loaded by the page (no new query). It replaces the D-21 (01e) layout that
 * pinned the agenda as a side column next to the main content.
 *
 * Source-level assertions (same pattern as `theme-tokens.test.ts`): rendering `.astro` files needs
 * a live admin session and Supabase data, out of scope for a unit test.
 */
const source = readFileSync(
  fileURLToPath(new URL("../dashboard.astro", import.meta.url)),
  "utf8",
);
const agendaSource = readFileSync(
  fileURLToPath(
    new URL("../../components/OperationalAgenda.astro", import.meta.url),
  ),
  "utf8",
);

describe("dashboard.astro layout (D-6, 01.2)", () => {
  it("renders DashboardContainer (header + KPI strip) before the agenda row", () => {
    const containerIndex = source.indexOf("<DashboardContainer");
    const agendaIndex = source.indexOf("<OperationalAgenda");
    expect(containerIndex).toBeGreaterThan(-1);
    expect(agendaIndex).toBeGreaterThan(-1);
    expect(containerIndex).toBeLessThan(agendaIndex);
  });

  it("no longer pins the agenda as the narrow side column of a page-level grid", () => {
    expect(source).not.toMatch(/lg:grid-cols-\[/);
    expect(source).not.toMatch(/class="mb-6">\s*<OperationalAgenda/);
  });

  it("does not load any extra data for the agenda row (single AgendaService call)", () => {
    expect(source.match(/await AgendaService\.getAgenda/g)).toHaveLength(1);
  });
});

describe("OperationalAgenda.astro (D-6, 01.2)", () => {
  it("puts the agenda in the wide left column and Próximas Operaciones in the right one", () => {
    expect(agendaSource).toMatch(
      /lg:grid-cols-\[minmax\(0,2fr\)_minmax\(0,1fr\)\]/,
    );
    const agendaIndex = agendaSource.indexOf("Agenda Operacional</h2>");
    const upcomingIndex = agendaSource.indexOf("Próximas Operaciones</h2>");
    expect(agendaIndex).toBeGreaterThan(-1);
    expect(upcomingIndex).toBeGreaterThan(agendaIndex);
  });

  it("renders each order as a chip (client + mono reference) instead of plain text", () => {
    expect(agendaSource).toMatch(/rounded-full/);
    expect(agendaSource).toMatch(
      /font-mono[^"]*"[^>]*>\s*\{entry\.reference\}/,
    );
  });

  it("tones the chips by slot using the functional palette tokens only", () => {
    expect(agendaSource).toContain("--color-warn-bg");
    expect(agendaSource).toContain("--color-info-bg");
    expect(agendaSource).not.toMatch(
      /\b(?:bg|text|border)-(?:red|green|blue|yellow|amber|emerald)-\d/,
    );
  });

  it("derives Próximas Operaciones from the agenda prop, with an explicit empty state", () => {
    expect(agendaSource).toMatch(/agenda\s*\.flatMap/);
    expect(agendaSource).toContain("Sin operaciones próximas");
    expect(agendaSource).toContain("Ver pedido");
  });
});
