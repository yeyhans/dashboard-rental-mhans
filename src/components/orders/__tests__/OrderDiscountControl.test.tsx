import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import OrderDiscountControl from "../OrderDiscountControl";

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

/** R-05: "Descuento" by % or by $ without a coupon, with the computed amount next to it. */
describe("OrderDiscountControl", () => {
  it("offers % and $ and shows the computed amount", () => {
    const html = renderToStaticMarkup(
      <OrderDiscountControl
        idPrefix="t"
        value={{ mode: "percent", value: "10" }}
        onChange={() => {}}
        productsSubtotal={81000}
      />,
    );
    expect(html).toContain("Descuento");
    expect(html).toMatch(/aria-pressed="true"[^>]*>%<\/button>/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>\$<\/button>/);
    expect(html).toContain("-$8.100");
  });

  it("is disabled with an explanation when a coupon is applied", () => {
    const html = renderToStaticMarkup(
      <OrderDiscountControl
        idPrefix="t"
        value={{ mode: "fixed", value: "" }}
        onChange={() => {}}
        productsSubtotal={81000}
        disabled
      />,
    );
    expect(html).toContain("El cupón aplicado reemplaza este descuento.");
    expect(html).toMatch(/<input[^>]*disabled=""/);
  });

  it("is wired into the order edit and the order creation forms", () => {
    const processOrder = read("../ProcessOrder.tsx");
    expect(processOrder).toContain("<OrderDiscountControl");
    expect(processOrder).toContain("discount_percent:");
    const createOrder = read("../CreateOrderForm.tsx");
    expect(createOrder).toContain("<OrderDiscountControl");
    expect(createOrder).toContain("manualDiscountPricing(");
  });
});
