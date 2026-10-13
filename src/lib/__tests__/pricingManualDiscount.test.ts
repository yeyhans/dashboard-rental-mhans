import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PricingError,
  computeOrderTotals,
  discountPercentPayload,
  initialManualDiscount,
  manualDiscountAmount,
  manualDiscountPricing,
  parseDiscountPercent,
} from "../pricing";

/**
 * R-05: a percentage discount on the order without a coupon. It applies to the same base as a
 * coupon — the products subtotal, never the shipping — rounds half-up to whole CLP, and lands in
 * `calculated_discount` like any other discount, so IVA, total and reserve are unchanged rules.
 * A coupon still wins.
 */
const LINES = [{ price: 1000, quantity: 1 }];

function totals(extra: Record<string, unknown>) {
  return computeOrderTotals({ lineItems: LINES, jornadas: 1, ...extra });
}

describe("computeOrderTotals — discountPercent", () => {
  it("takes the percentage of the products subtotal", () => {
    const result = totals({ discountPercent: 10 });
    expect(result.discount).toBe(100);
    expect(result.net).toBe(900);
    expect(result.iva).toBe(171);
  });

  it("leaves shipping out of the discount base, like a coupon", () => {
    const result = totals({ discountPercent: 50, shippingTotal: 500 });
    expect(result.discount).toBe(500);
    expect(result.net).toBe(1000);
  });

  it("rounds half-up to whole CLP", () => {
    // 1001 x 33.33% = 333.6333 -> 334; 1001 x 12.5% = 125.125 -> 125
    expect(
      computeOrderTotals({
        lineItems: [{ price: 1001, quantity: 1 }],
        jornadas: 1,
        discountPercent: 33.33,
      }).discount,
    ).toBe(334);
    expect(
      computeOrderTotals({
        lineItems: [{ price: 1001, quantity: 1 }],
        jornadas: 1,
        discountPercent: 12.5,
      }).discount,
    ).toBe(125);
  });

  it("100% discounts all the products", () => {
    const result = totals({ discountPercent: 100, shippingTotal: 300 });
    expect(result.discount).toBe(1000);
    expect(result.net).toBe(300);
  });

  it("wins over a flat discount when both are sent", () => {
    expect(totals({ discountPercent: 10, discount: 700 }).discount).toBe(100);
  });

  it("loses to a coupon", () => {
    const result = totals({
      discountPercent: 50,
      coupon: { discount_type: "percent", amount: 10 },
    });
    expect(result.discount).toBe(100);
  });
});

describe("parseDiscountPercent", () => {
  it("reads empty values as no percentage", () => {
    expect(parseDiscountPercent(null)).toBeNull();
    expect(parseDiscountPercent(undefined)).toBeNull();
    expect(parseDiscountPercent("")).toBeNull();
  });

  it("accepts (0, 100] with up to two decimals", () => {
    expect(parseDiscountPercent("12.5")).toBe(12.5);
    expect(parseDiscountPercent(100)).toBe(100);
    expect(parseDiscountPercent(0.01)).toBe(0.01);
    // 33.33 x 100 is 3332.9999999999995 in binary floating point: still two decimals.
    expect(parseDiscountPercent("33.33")).toBe(33.33);
  });

  it.each([0, -1, 100.01, "abc", 12.345])("rejects %s", (value) => {
    expect(() => parseDiscountPercent(value)).toThrow(PricingError);
  });
});

describe("manual discount control helpers", () => {
  it("maps the control to pricing inputs", () => {
    expect(manualDiscountPricing({ mode: "percent", value: "15" })).toEqual({
      discount: null,
      discountPercent: 15,
    });
    expect(manualDiscountPricing({ mode: "fixed", value: "5000" })).toEqual({
      discount: 5000,
      discountPercent: null,
    });
    expect(manualDiscountPricing({ mode: "percent", value: "" })).toEqual({
      discount: null,
      discountPercent: null,
    });
  });

  it("previews the amount in CLP", () => {
    expect(manualDiscountAmount({ mode: "percent", value: "10" }, 81000)).toBe(
      8100,
    );
    expect(manualDiscountAmount({ mode: "fixed", value: "90000" }, 81000)).toBe(
      81000,
    );
    expect(manualDiscountAmount({ mode: "percent", value: "150" }, 81000)).toBe(
      0,
    );
  });

  it("starts from the stored percentage, else the stored amount", () => {
    expect(initialManualDiscount(12.5, 9000)).toEqual({
      mode: "percent",
      value: "12.5",
    });
    expect(initialManualDiscount(null, 9000)).toEqual({
      mode: "fixed",
      value: "9000",
    });
    expect(initialManualDiscount(undefined, 0)).toEqual({
      mode: "fixed",
      value: "",
    });
  });
});

/** H-3: the edit form sends `discount_percent` only when the discount control was touched. */
describe("discountPercentPayload", () => {
  it("leaves the field out when the control was not touched", () => {
    expect(
      discountPercentPayload(
        { mode: "fixed", value: "" },
        { touched: false, couponApplied: false },
      ),
    ).toBeUndefined();
  });

  it("sends the percentage, or null to clear it, once touched", () => {
    expect(
      discountPercentPayload(
        { mode: "percent", value: "10" },
        { touched: true, couponApplied: false },
      ),
    ).toBe(10);
    expect(
      discountPercentPayload(
        { mode: "fixed", value: "5000" },
        { touched: true, couponApplied: false },
      ),
    ).toBeNull();
  });

  it("never sends it while a coupon is applied", () => {
    expect(
      discountPercentPayload(
        { mode: "percent", value: "10" },
        { touched: true, couponApplied: true },
      ),
    ).toBeUndefined();
  });

  it("is what ProcessOrder uses to build the payload", () => {
    const source = readFileSync(
      fileURLToPath(
        new URL("../../components/orders/ProcessOrder.tsx", import.meta.url),
      ),
      "utf8",
    );
    expect(source).toContain(
      "discount_percent: discountPercentPayload(manualDiscount, {",
    );
  });
});
