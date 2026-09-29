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

  it("renders without an icon wrapper when no icon is given", () => {
    const withIcon = renderToStaticMarkup(
      <KpiCard icon={FakeIcon} label="Pendientes Hoy" value={4} />,
    );
    const withoutIcon = renderToStaticMarkup(
      <KpiCard label="Pendientes Hoy" value={4} />,
    );
    expect(withIcon).toMatch(/rounded-full/);
    expect(withoutIcon).not.toMatch(/rounded-full/);
    expect(withoutIcon).toContain("Pendientes Hoy");
  });

  it("accepts a ReactNode value for tone-colored figures", () => {
    const html = renderToStaticMarkup(
      <KpiCard
        label="Devoluciones Atrasadas"
        value={<span className="text-[var(--color-warn)]">2</span>}
      />,
    );
    expect(html).toContain("text-[var(--color-warn)]");
    expect(html).toContain(">2<");
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

  it("renders a numeric 0 footer wrapped in the footer container, not as a bare leak", () => {
    const html = renderToStaticMarkup(
      <KpiCard icon={FakeIcon} label="Pedidos activos" value={12} footer={0} />,
    );
    expect(html).toMatch(/<div[^>]*mt-3[^>]*>0<\/div>/);
  });
});
