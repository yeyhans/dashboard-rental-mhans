import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../../../lib/siteSettings";
import SiteSettingsForm from "../SiteSettingsForm";

/**
 * Markup of the form with `react-dom/server` (no jsdom in this project). Interactions (save,
 * upload validation) are covered as pure functions in `siteSettingsClient.test.ts`.
 */
describe("SiteSettingsForm", () => {
  it("renders the page header, the six tabs and the save button", () => {
    const html = renderToStaticMarkup(
      <SiteSettingsForm initialSettings={DEFAULT_SETTINGS} />,
    );

    expect(html).toContain("Configuración del sitio");
    for (const label of [
      "Empresa",
      "Representante y firma",
      "Banco",
      "Contacto",
      "Direcciones de retiro",
      "Reserva y políticas",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("Guardar cambios");
  });

  it("shows the company values on the first tab", () => {
    const html = renderToStaticMarkup(
      <SiteSettingsForm initialSettings={DEFAULT_SETTINGS} />,
    );
    expect(html).toContain('value="Hans Salinas SpA"');
    expect(html).toContain("77.892.569-9");
  });

  it("shows the current signature image on the signature tab", () => {
    const html = renderToStaticMarkup(
      <SiteSettingsForm
        initialSettings={DEFAULT_SETTINGS}
        initialTab="firma"
      />,
    );
    expect(html).toContain(
      `src="${DEFAULT_SETTINGS.representative.signatureUrl}"`,
    );
    expect(html).toContain('accept="image/png,image/jpeg"');
  });

  it("shows the empty state when there is no signature", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      representative: { ...DEFAULT_SETTINGS.representative, signatureUrl: "" },
    };
    const html = renderToStaticMarkup(
      <SiteSettingsForm initialSettings={settings} initialTab="firma" />,
    );
    expect(html).toContain("Sin firma cargada");
    expect(html).not.toContain("<img");
  });

  it("lists every pickup address on its tab", () => {
    const html = renderToStaticMarkup(
      <SiteSettingsForm
        initialSettings={DEFAULT_SETTINGS}
        initialTab="retiro"
      />,
    );
    expect(html).toContain("Purísima 25, Recoleta");
    expect(html).toContain("Bellavista 77, Recoleta");
  });

  it("contains no emojis", () => {
    const html = renderToStaticMarkup(
      <SiteSettingsForm initialSettings={DEFAULT_SETTINGS} />,
    );
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
