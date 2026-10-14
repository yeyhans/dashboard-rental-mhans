import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "../StatusBadge";

/**
 * Rendered with `react-dom/server` rather than a DOM testing library: the project has no jsdom
 * or `@testing-library/react` (see the note on `statusBadgeClass` in `src/lib/orderStatus.ts`),
 * and D-03 must not add a dependency (node_modules is a junction shared with production).
 * `renderToStaticMarkup` needs no DOM — it is the same primitive Astro's SSR uses — so the
 * markup structure is still covered by a real render, not just a snapshot of props.
 */
describe("StatusBadge", () => {
  it("renders the label text", () => {
    const html = renderToStaticMarkup(
      <StatusBadge tone="ok" label="Confirmado" />,
    );
    expect(html).toContain("Confirmado");
  });

  it("renders a dot and pill using the tone's semantic classes", () => {
    const html = renderToStaticMarkup(
      <StatusBadge tone="crit" label="Crítico" />,
    );
    expect(html).toContain("bg-[var(--color-crit-bg)]");
    expect(html).toContain("text-[var(--color-crit)]");
    expect(html).toContain("bg-[var(--color-crit)]");
  });

  it("falls back to the neutral tone for an unrecognised value", () => {
    // @ts-expect-error exercising the runtime fallback for an invalid tone
    const html = renderToStaticMarkup(<StatusBadge tone="bogus" label="?" />);
    expect(html).toContain("bg-[var(--color-neutral-bg)]");
  });

  it("keeps the default pill typography (12px, sentence case)", () => {
    const html = renderToStaticMarkup(<StatusBadge tone="ok" label="Ok" />);
    expect(html).toContain("text-xs font-medium");
    expect(html).not.toContain("uppercase");
  });

  it("renders the canon Pedidos badge: 10px semibold uppercase, tracked, 3x9 padding", () => {
    const html = renderToStaticMarkup(
      <StatusBadge tone="ok" label="Confirmado" variant="canon" />,
    );
    expect(html).toMatch(
      /text-\[10px\][^"]*font-semibold[^"]*uppercase[^"]*tracking-\[0\.04em\]/,
    );
    expect(html).toContain("px-[9px] py-[3px]");
    expect(html).toContain("bg-[var(--color-ok-bg)]");
    expect(html).not.toContain("text-xs font-medium");
  });

  it("hides the dot from assistive tech", () => {
    const html = renderToStaticMarkup(<StatusBadge tone="info" label="Info" />);
    expect(html).toContain('aria-hidden="true"');
  });
});
