import { describe, expect, it } from "vitest";
import { renderTransactionalEmail } from "../transactionalEmail";

/**
 * R-09e: the Registro design carries an optional "Crear mi contraseña" button for accounts an
 * admin creates. The self-registration use passes no link and must render as before.
 */
describe("renderTransactionalEmail — registro", () => {
  const link =
    "https://new.mariohans.cl/reset-password?token_hash=abc123&type=recovery";

  it("renders the Crear mi contraseña button with the recovery link", () => {
    const { html } = renderTransactionalEmail("registro", {
      nombre_cliente: "Ana",
      usuario: "ana@example.cl",
      link_crear_contrasena: link,
    });

    expect(html).toContain("Crear mi contraseña");
    expect(html).toContain(
      'href="https://new.mariohans.cl/reset-password?token_hash=abc123&amp;type=recovery"',
    );
    expect(html).not.toMatch(/\{\{[#/]?\w+\}\}/);
  });

  it("omits the whole button block when there is no link", () => {
    const { html } = renderTransactionalEmail("registro", {
      nombre_cliente: "Ana",
      usuario: "ana@example.cl",
    });

    expect(html).not.toContain("Crear mi contraseña");
    expect(html).not.toContain("reset-password");
    expect(html).not.toMatch(/\{\{[#/]?\w+\}\}/);
    // The rest of the design is untouched.
    expect(html).toContain("Completa tu registro");
  });

  it("refuses a link that is not http(s)", () => {
    const { html } = renderTransactionalEmail("registro", {
      link_crear_contrasena: "javascript:alert(1)",
    });
    expect(html).not.toContain("javascript:");
  });
});
