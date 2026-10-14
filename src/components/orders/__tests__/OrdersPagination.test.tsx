import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  OrdersPagination,
  paginationItems,
  paginationLabel,
} from "../OrdersPagination";

describe("paginationLabel (canon 'Mostrando a a b de N pedidos')", () => {
  it("shows the visible range and the filtered total", () => {
    expect(paginationLabel(1, 10, 38)).toBe("Mostrando 1 a 10 de 38 pedidos");
    expect(paginationLabel(4, 10, 38)).toBe("Mostrando 31 a 38 de 38 pedidos");
  });

  it("uses the singular for a single order and handles an empty list", () => {
    expect(paginationLabel(1, 10, 1)).toBe("Mostrando 1 a 1 de 1 pedido");
    expect(paginationLabel(1, 10, 0)).toBe("Mostrando 0 de 0 pedidos");
  });
});

describe("paginationItems", () => {
  it("lists every page when there are five or fewer", () => {
    expect(paginationItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(paginationItems(1, 1)).toEqual([1]);
    expect(paginationItems(1, 0)).toEqual([]);
  });

  it("collapses the gaps with an ellipsis like the canon (1 2 3 … N)", () => {
    expect(paginationItems(1, 10)).toEqual([1, 2, 3, "ellipsis", 10]);
    expect(paginationItems(5, 10)).toEqual([
      1,
      "ellipsis",
      4,
      5,
      6,
      "ellipsis",
      10,
    ]);
    expect(paginationItems(10, 10)).toEqual([1, "ellipsis", 8, 9, 10]);
  });

  it("shows the single hidden page instead of an ellipsis for a one-page gap", () => {
    expect(paginationItems(4, 10)).toEqual([1, 2, 3, 4, 5, "ellipsis", 10]);
  });
});

describe("OrdersPagination", () => {
  const render = (currentPage: number, totalPages: number) =>
    renderToStaticMarkup(
      <OrdersPagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={10}
        totalItems={totalPages * 10}
        onPageChange={() => {}}
      />,
    );

  it("renders the label on the left and 28px square page buttons", () => {
    const html = render(1, 10);
    expect(html).toContain("Mostrando 1 a 10 de 100 pedidos");
    expect(html).toMatch(/h-7 w-7[^"]*rounded-\[5px\]/);
  });

  it("marks the current page black and aria-current", () => {
    const html = render(2, 10);
    expect(html).toMatch(
      /aria-current="page"[^>]*class="[^"]*bg-foreground[^"]*text-background|class="[^"]*bg-foreground[^"]*text-background[^"]*"[^>]*aria-current="page"/,
    );
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("uses labelled chevron buttons, disabled at the ends", () => {
    const first = render(1, 10);
    expect(first).toMatch(
      /<button[^>]*disabled=""[^>]*aria-label="Página anterior"|<button[^>]*aria-label="Página anterior"[^>]*disabled=""/,
    );
    expect(first).toContain('aria-label="Página siguiente"');
    const last = render(10, 10);
    expect(last).toMatch(
      /<button[^>]*disabled=""[^>]*aria-label="Página siguiente"|<button[^>]*aria-label="Página siguiente"[^>]*disabled=""/,
    );
  });

  it("renders the ellipsis as inert text", () => {
    expect(render(1, 10)).toContain("…");
  });

  it("omits the page buttons when everything fits on one page", () => {
    const html = render(1, 1);
    expect(html).toContain("Mostrando 1 a 10 de 10 pedidos");
    expect(html).not.toContain("Página siguiente");
  });
});
