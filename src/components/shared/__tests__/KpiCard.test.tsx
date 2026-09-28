import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KpiCard } from "../KpiCard";

function FakeIcon({ className }: { className?: string }) {
  return <svg data-testid="fake-icon" className={className} />;
}

describe("KpiCard", () => {
  it("renders the icon inside a circular wrapper", () => {
    const html = renderToStaticMarkup(
      <KpiCard icon={FakeIcon} label="Pedidos activos" value={12} />,
    );
    expect(html).toMatch(
      /<span[^>]*class="[^"]*rounded-full[^"]*"[^>]*>.*fake-icon/,
    );
  });

  it("renders the label and the value", () => {
    const html = renderToStaticMarkup(
      <KpiCard icon={FakeIcon} label="Pedidos activos" value={12} />,
    );
    expect(html).toContain("Pedidos activos");
    expect(html).toContain(">12<");
  });

  it("renders string values verbatim, e.g. formatted currency", () => {
    const html = renderToStaticMarkup(
      <KpiCard icon={FakeIcon} label="Ingresos" value="$1.200.000" />,
    );
    expect(html).toContain("$1.200.000");
  });

  it("renders the footer when given, and omits it when not", () => {
    const withFooter = renderToStaticMarkup(
      <KpiCard
        icon={FakeIcon}
        label="Pedidos activos"
        value={12}
        footer="+3 esta semana"
      />,
    );
    const withoutFooter = renderToStaticMarkup(
      <KpiCard icon={FakeIcon} label="Pedidos activos" value={12} />,
    );
    expect(withFooter).toContain("+3 esta semana");
    expect(withoutFooter).not.toContain("+3 esta semana");
  });
});
