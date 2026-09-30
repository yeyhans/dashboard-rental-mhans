import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * D-22 (02c/02d/02g): source-level assertions over `OrdersDashboard.tsx`. This project has no
 * jsdom/testing-library (see `vitest.config.ts`), and these checks are about which class names
 * and strings the component emits — a `renderToStaticMarkup` string-contains test would assert
 * the exact same thing with more setup, so the source is read directly instead.
 */
const source = readFileSync(
  path.resolve(__dirname, "../OrdersDashboard.tsx"),
  "utf-8",
);

describe("OrdersDashboard — source assertions (D-22)", () => {
  it("does not color the Inicio/Término date cells green/red (02d)", () => {
    expect(source).not.toContain("text-green-600");
    expect(source).not.toContain("text-red-600");
  });

  it("formats the Inicio/Término dates with the shared weekday helper (02d)", () => {
    expect(source).toContain("formatOrderDateWithWeekday");
  });

  it('keeps "Registrar Devolución" next to "Nuevo Pedido" (02c)', () => {
    expect(source).toContain("Registrar Devolución");
    expect(source).toContain('href="/check-in"');
  });

  it("does not style the budget PDF icon with off-palette Tailwind blue (02g)", () => {
    expect(source).not.toContain("bg-blue-200");
    expect(source).not.toContain("text-blue-900");
  });
});
