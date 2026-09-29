import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageHeader } from "../PageHeader";

describe("PageHeader", () => {
  it("renders the title as an uppercase h1", () => {
    const html = renderToStaticMarkup(<PageHeader title="Centro de Control" />);
    expect(html).toMatch(
      /<h1[^>]*class="[^"]*uppercase[^"]*"[^>]*>Centro de Control<\/h1>/,
    );
  });

  it("renders the subtitle when given", () => {
    const html = renderToStaticMarkup(
      <PageHeader
        title="Pedidos"
        subtitle="Gestiona el ciclo completo del arriendo"
      />,
    );
    expect(html).toContain("Gestiona el ciclo completo del arriendo");
  });

  it("omits the subtitle paragraph when not given", () => {
    const withSubtitle = renderToStaticMarkup(
      <PageHeader title="Pedidos" subtitle="Detalle" />,
    );
    const withoutSubtitle = renderToStaticMarkup(
      <PageHeader title="Pedidos" />,
    );
    expect(withSubtitle).toContain("Detalle");
    expect(withoutSubtitle).not.toContain("Detalle");
  });

  it("renders the date when given", () => {
    const html = renderToStaticMarkup(
      <PageHeader title="Pedidos" date="28/09/2026" />,
    );
    expect(html).toContain("28/09/2026");
  });

  it("renders the actions slot content", () => {
    const html = renderToStaticMarkup(
      <PageHeader
        title="Pedidos"
        actions={<button type="button">Nuevo Pedido</button>}
      />,
    );
    expect(html).toContain("Nuevo Pedido");
  });

  it("renders a numeric 0 actions slot wrapped in the actions container, not as a bare leak", () => {
    const html = renderToStaticMarkup(
      <PageHeader title="Pedidos" actions={0} />,
    );
    expect(html).toMatch(/<div[^>]*gap-2[^>]*>0<\/div>/);
  });

  it("omits the actions wrapper when actions is not given", () => {
    const html = renderToStaticMarkup(<PageHeader title="Pedidos" />);
    expect(html).not.toMatch(/>0</);
    // Same reasoning as KpiCard's footer: the container itself must be gone, not just its text.
    expect(html).not.toMatch(/gap-2/);
  });

  it("omits the actions wrapper when actions is false", () => {
    const html = renderToStaticMarkup(
      <PageHeader title="Pedidos" actions={false} />,
    );
    expect(html).not.toMatch(/gap-2/);
  });

  it("omits the actions wrapper when actions is an empty string", () => {
    const html = renderToStaticMarkup(
      <PageHeader title="Pedidos" actions="" />,
    );
    expect(html).not.toMatch(/gap-2/);
  });
});
