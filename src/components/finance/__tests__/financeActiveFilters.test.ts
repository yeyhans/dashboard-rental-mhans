import { describe, expect, it } from "vitest";
import {
  financeActiveFilterChips,
  financeSummaryFilterLabel,
} from "../financeActiveFilters";

describe("financeActiveFilterChips", () => {
  it("returns no chips when nothing is filtered", () => {
    expect(
      financeActiveFilterChips({
        search: "",
        paymentFilter: "all",
        showPaymentFilter: true,
      }),
    ).toEqual([]);
  });

  it("returns a Cliente chip when the search box has text", () => {
    const chips = financeActiveFilterChips({
      search: "Ana Pérez",
      paymentFilter: "all",
      showPaymentFilter: true,
    });
    expect(chips).toEqual([{ key: "search", label: "Cliente: Ana Pérez" }]);
  });

  it("trims whitespace-only search instead of treating it as active", () => {
    expect(
      financeActiveFilterChips({
        search: "   ",
        paymentFilter: "all",
        showPaymentFilter: true,
      }),
    ).toEqual([]);
  });

  it("returns an Estado chip with the canon label when the payment filter is active", () => {
    const chips = financeActiveFilterChips({
      search: "",
      paymentFilter: "overdue",
      showPaymentFilter: true,
    });
    expect(chips).toEqual([{ key: "payment", label: "Estado: Vencido" }]);
  });

  it("ignores the payment filter on tabs that do not offer it (Pagados)", () => {
    expect(
      financeActiveFilterChips({
        search: "",
        paymentFilter: "overdue",
        showPaymentFilter: false,
      }),
    ).toEqual([]);
  });

  it("returns both chips, search first, when both filters are active", () => {
    const chips = financeActiveFilterChips({
      search: "Ana",
      paymentFilter: "no-reserve",
      showPaymentFilter: true,
    });
    expect(chips.map((c) => c.key)).toEqual(["search", "payment"]);
  });
});

describe("financeSummaryFilterLabel", () => {
  it("returns just the period label when no filter is active", () => {
    expect(
      financeSummaryFilterLabel({ periodLabel: "Este mes", chips: [] }),
    ).toBe("Este mes");
  });

  it("appends every active chip's label after the period", () => {
    expect(
      financeSummaryFilterLabel({
        periodLabel: "Este mes",
        chips: [
          { key: "search", label: "Cliente: Ana" },
          { key: "payment", label: "Estado: Vencido" },
        ],
      }),
    ).toBe("Este mes · Cliente: Ana · Estado: Vencido");
  });
});
