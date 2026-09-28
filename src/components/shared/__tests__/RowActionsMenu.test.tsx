import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RowActionsMenu } from "../RowActionsMenu";

/**
 * The Radix `DropdownMenu` content is portalled and closed by default, so a static-markup render
 * only ever shows the trigger — see `rowActionsMenu.test.ts` for the destructive-styling logic
 * that lives outside Radix and is covered directly.
 */
describe("RowActionsMenu", () => {
  it("renders a trigger button with the default accessible label", () => {
    const html = renderToStaticMarkup(
      <RowActionsMenu items={[{ label: "Ver ficha", onSelect: () => {} }]} />,
    );
    expect(html).toContain('aria-label="Más acciones"');
  });

  it("accepts a custom accessible label", () => {
    const html = renderToStaticMarkup(
      <RowActionsMenu
        label="Acciones de la orden"
        items={[{ label: "Ver", onSelect: () => {} }]}
      />,
    );
    expect(html).toContain('aria-label="Acciones de la orden"');
  });
});
