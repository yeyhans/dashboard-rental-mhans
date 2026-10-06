import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FinancialSummary from "../FinancialSummary";

const OFF_PALETTE =
  /(text|bg|border)-(red|green|yellow|blue|orange|purple|indigo|emerald|amber)-\d{2,3}/;

const summary = {
  totalSales: 1000000,
  totalPaid: 600000,
  totalPending: 400000,
  reservationPayments: 250000,
  finalPayments: 350000,
};

describe("FinancialSummary (01b.3)", () => {
  const html = renderToStaticMarkup(
    <FinancialSummary financialSummary={summary} />,
  );

  it("keeps every figure and surface inside the palette", () => {
    expect(html).not.toMatch(OFF_PALETTE);
  });

  it("shows the pending amount in crit and the other figures in ink", () => {
    expect(html).toMatch(
      /<div[^>]*text-\[var\(--color-crit\)\][^>]*>\$\s?400\.000/,
    );
    expect(html).toMatch(/<div[^>]*text-foreground[^>]*>\$\s?1\.000\.000/);
    expect(html).toMatch(/<div[^>]*text-foreground[^>]*>\$\s?600\.000/);
  });

  it("drops the decorative circle", () => {
    expect(html).not.toContain("rounded-full -mr-10");
    expect(html).not.toContain("-mt-10");
  });
});
