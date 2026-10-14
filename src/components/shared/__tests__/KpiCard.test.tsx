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

  it("renders the footer when given, and omits the whole container when not", () => {
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
    // Omission means the footer container itself is absent, not just its text — a
    // `footer={undefined}` that still rendered an empty `<div class="... mt-3 ...">` would pass
    // the assertion above while leaking an empty box into the layout.
    expect(withoutFooter).not.toMatch(/mt-3/);
  });

  it("renders a numeric 0 footer wrapped in the footer container, not as a bare leak", () => {
    const html = renderToStaticMarkup(
      <KpiCard icon={FakeIcon} label="Pedidos activos" value={12} footer={0} />,
    );
    expect(html).toMatch(/<div[^>]*mt-3[^>]*>0<\/div>/);
  });

  it("omits the footer container when footer is false", () => {
    const html = renderToStaticMarkup(
      <KpiCard
        icon={FakeIcon}
        label="Pedidos activos"
        value={12}
        footer={false}
      />,
    );
    expect(html).not.toMatch(/mt-3/);
  });

  it("omits the footer container when footer is an empty string", () => {
    const html = renderToStaticMarkup(
      <KpiCard icon={FakeIcon} label="Pedidos activos" value={12} footer="" />,
    );
    expect(html).not.toMatch(/mt-3/);
  });

  it("renders a sparkline polyline when given 2+ values (D-24 07d)", () => {
    const html = renderToStaticMarkup(
      <KpiCard
        icon={FakeIcon}
        label="Monto Pendiente"
        value="$100.000"
        sparkline={[10, 20, 5, 30]}
      />,
    );
    expect(html).toMatch(/<svg[^>]*><polyline points="[^"]+"/);
  });

  it("omits the sparkline svg when not given one", () => {
    const html = renderToStaticMarkup(
      <KpiCard icon={FakeIcon} label="Monto Pendiente" value="$100.000" />,
    );
    expect(html).not.toContain("<polyline");
  });

  it("keeps the label on up to two lines instead of cutting it (01.1)", () => {
    const html = renderToStaticMarkup(
      <KpiCard label="Devoluciones Atrasadas del Mes" value={3} />,
    );
    expect(html).not.toMatch(/<p[^>]*class="[^"]*\btruncate\b[^"]*"/);
    expect(html).toMatch(/line-clamp-2/);
  });

  it("renders the value in the mono font and lets long figures wrap inside the card", () => {
    const html = renderToStaticMarkup(
      <KpiCard label="Cobros Pendientes" value="$12.345.678" />,
    );
    expect(html).toMatch(
      /<p[^>]*class="[^"]*font-mono[^"]*"[^>]*>\$12\.345\.678/,
    );
    expect(html).toMatch(/<p[^>]*class="[^"]*break-words[^"]*"/);
  });

  it("renders a 'Ver detalle' footer link when an href is given", () => {
    const html = renderToStaticMarkup(
      <KpiCard label="Pedidos Activos" value={4} href="/orders" />,
    );
    expect(html).toMatch(/<a[^>]*href="\/orders"[^>]*>Ver detalle/);
  });

  it("omits the 'Ver detalle' link when no href is given", () => {
    const html = renderToStaticMarkup(
      <KpiCard label="Pedidos Activos" value={4} />,
    );
    expect(html).not.toContain("Ver detalle");
  });

  it("omits the sparkline svg for a single-value or empty series", () => {
    const single = renderToStaticMarkup(
      <KpiCard
        icon={FakeIcon}
        label="Monto Pendiente"
        value="$100.000"
        sparkline={[10]}
      />,
    );
    const empty = renderToStaticMarkup(
      <KpiCard
        icon={FakeIcon}
        label="Monto Pendiente"
        value="$100.000"
        sparkline={[]}
      />,
    );
    expect(single).not.toContain("<polyline");
    expect(empty).not.toContain("<polyline");
  });
});

describe("KpiCard — canon variant (Pedidos RC2.1.2 .kpi-card)", () => {
  it("keeps the default variant unchanged: a div with the 40px icon and no 28px value", () => {
    const html = renderToStaticMarkup(
      <KpiCard icon={FakeIcon} label="Pedidos activos" value={12} />,
    );
    expect(html.startsWith("<div")).toBe(true);
    expect(html).toContain("h-10 w-10");
    expect(html).not.toContain("text-[28px]");
  });

  it("renders the canon geometry: 30px round icon, 11px label, 28px bold value", () => {
    const html = renderToStaticMarkup(
      <KpiCard variant="canon" icon={FakeIcon} label="Retiros Hoy" value={5} />,
    );
    expect(html).toMatch(/h-\[30px\] w-\[30px\][^"]*rounded-full/);
    expect(html).toContain("text-[11px]");
    expect(html).toMatch(/text-\[28px\][^"]*font-bold/);
    expect(html).toContain("Retiros Hoy");
    expect(html).toContain(">5<");
  });

  it("renders the meta line only when given", () => {
    const withMeta = renderToStaticMarkup(
      <KpiCard
        variant="canon"
        label="Retiros Hoy"
        value={5}
        meta="Programados →"
      />,
    );
    const withoutMeta = renderToStaticMarkup(
      <KpiCard variant="canon" label="Retiros Hoy" value={5} />,
    );
    expect(withMeta).toContain("Programados →");
    expect(withoutMeta).not.toContain("color-text-faint");
  });

  it("renders a real button when the card is clickable, and a div otherwise", () => {
    const clickable = renderToStaticMarkup(
      <KpiCard
        variant="canon"
        label="Retiros Hoy"
        value={5}
        onClick={() => {}}
      />,
    );
    const inert = renderToStaticMarkup(
      <KpiCard variant="canon" label="Retiros Hoy" value={5} />,
    );
    expect(clickable).toMatch(/^<button[^>]*type="button"/);
    expect(inert.startsWith("<div")).toBe(true);
  });

  it("marks the clickable card pressed when its filter is the active one", () => {
    const html = renderToStaticMarkup(
      <KpiCard
        variant="canon"
        label="Retiros Hoy"
        value={5}
        onClick={() => {}}
        isActive
      />,
    );
    expect(html).toContain('aria-pressed="true"');
  });
});
