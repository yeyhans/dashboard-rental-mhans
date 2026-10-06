import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RentedEquipmentTable, {
  daysRemainingTone,
} from "../RentedEquipmentTable";

const OFF_PALETTE = /text-(red|green|yellow|blue|orange|purple)-\d{3}/;

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    productName: "Canon R5 con lente 24-70mm",
    productImage: "/img.png",
    orderId: 321,
    orderProject: "Campaña invierno",
    endDate: "2026-10-15",
    status: "processing",
    daysRemaining: 2,
    ...overrides,
  };
}

function render(items = [makeItem()]) {
  return renderToStaticMarkup(<RentedEquipmentTable rentedEquipment={items} />);
}

describe("daysRemainingTone (01b.1)", () => {
  it("maps overdue and almost-due to crit, a week to warn, the rest to ok", () => {
    expect(daysRemainingTone(-2)).toBe("crit");
    expect(daysRemainingTone(2)).toBe("crit");
    expect(daysRemainingTone(5)).toBe("warn");
    expect(daysRemainingTone(20)).toBe("ok");
  });
});

describe("RentedEquipmentTable", () => {
  it("renders 'Tiempo restante' as a single-tone StatusBadge, not a multicolour badge (01b.1)", () => {
    const html = render();
    expect(html).toMatch(
      /bg-\[var\(--color-crit-bg\)\][^"]*text-\[var\(--color-crit\)\][^>]*>.*2 días/s,
    );
    expect(html).not.toMatch(OFF_PALETTE);
  });

  it("labels an overdue item with the days overdue", () => {
    expect(render([makeItem({ daysRemaining: -3 })])).toContain(
      "Vencido (3 días)",
    );
  });

  it("keeps cells on one line and shows the order ID in mono (01b.2)", () => {
    const html = render();
    expect(html).toContain("whitespace-nowrap");
    expect(html).toMatch(/<td[^>]*font-mono[^>]*>#321/);
  });

  it("uses neutral icons and figures in the counters (01b.4)", () => {
    const html = render();
    expect(html).not.toMatch(OFF_PALETTE);
    expect(html).not.toMatch(/text-(red|green|yellow|blue)-500/);
  });
});
