import { describe, expect, it } from "vitest";
import {
  TRANSACTIONAL_EMAIL_KEYS,
  renderTransactionalEmail,
  type TransactionalEmailKey,
} from "../transactionalEmail";
import { EMAIL_ON_ENTER } from "../orderStatus";

/**
 * R-09b: the eight approved transactional emails (`correos/Correo *.html`), ported to
 * `src/templates/emails/transactional/` with the handoff §6 variables, rendered by one pure
 * function that HTML-escapes every value.
 */
const DATA = {
  nombre_cliente: "Ana Pérez",
  usuario: "anaperez",
  numero_pedido: "1573",
  link_pdf: "https://files.example/presupuesto-1573.pdf",
  detalle_modificaciones: "Se cambió la Canon R5 por una R6",
};

describe("renderTransactionalEmail", () => {
  it("knows the eight emails of the handoff", () => {
    expect([...TRANSACTIONAL_EMAIL_KEYS].sort()).toEqual(
      [
        "contrato",
        "equipos-disponibles",
        "equipos-entregados",
        "equipos-no-disponibles",
        "pedido-actualizado",
        "pedido-completado",
        "registro",
        "solicitud-recibida",
      ].sort(),
    );
  });

  it("covers every status email key", () => {
    for (const key of Object.values(EMAIL_ON_ENTER)) {
      expect(TRANSACTIONAL_EMAIL_KEYS).toContain(key);
    }
  });

  it.each(TRANSACTIONAL_EMAIL_KEYS)(
    "renders %s with no placeholder left",
    (key) => {
      const { subject, html } = renderTransactionalEmail(
        key as TransactionalEmailKey,
        DATA,
      );
      expect(subject).toMatch(/^Mario Hans FotoRental · .+/);
      expect(html).not.toContain("{{");
      expect(html).not.toContain("}}");
      expect(html).toContain("Ana Pérez");
      expect(html).not.toContain("data:image");
      expect(html).not.toContain("56900000000");
    },
  );

  it("uses the subject of each design's <title>", () => {
    expect(renderTransactionalEmail("registro", DATA).subject).toBe(
      "Mario Hans FotoRental · Registro",
    );
    expect(renderTransactionalEmail("equipos-entregados", DATA).subject).toBe(
      "Mario Hans FotoRental · Equipos entregados",
    );
  });

  it("fills the order number, the PDF link and the modification detail", () => {
    expect(renderTransactionalEmail("solicitud-recibida", DATA).html).toContain(
      "#1573",
    );
    expect(
      renderTransactionalEmail("equipos-disponibles", DATA).html,
    ).toContain('href="https://files.example/presupuesto-1573.pdf"');
    expect(renderTransactionalEmail("pedido-actualizado", DATA).html).toContain(
      "Se cambió la Canon R5 por una R6",
    );
  });

  it("escapes every variable", () => {
    const { html } = renderTransactionalEmail("registro", {
      ...DATA,
      nombre_cliente: '<script>alert("x")</script> & Cía',
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Cía",
    );
  });

  it("refuses a link that is not http(s)", () => {
    const { html } = renderTransactionalEmail("equipos-disponibles", {
      ...DATA,
      link_pdf: "javascript:alert(1)",
    });
    expect(html).not.toContain("javascript:");
  });

  it("uses the business WhatsApp and a hosted logo by default", () => {
    const { html } = renderTransactionalEmail("registro", DATA);
    expect(html).toContain("https://wa.me/56990818976");
    expect(html).toMatch(/<img src="https:\/\/[^"]+\.png"/);
  });

  it("throws for an unknown key", () => {
    expect(() =>
      renderTransactionalEmail("nope" as TransactionalEmailKey, DATA),
    ).toThrow();
  });
});

describe("renderTransactionalEmail — order without a PDF yet (R-09d)", () => {
  it("points the download button at the customer's orders page", () => {
    const { html } = renderTransactionalEmail("solicitud-recibida", {
      nombre_cliente: "Ana",
      numero_pedido: 9,
    });
    expect(html).toMatch(/href="https:\/\/[^"]+\/cuenta\/pedidos"/);
  });
});
