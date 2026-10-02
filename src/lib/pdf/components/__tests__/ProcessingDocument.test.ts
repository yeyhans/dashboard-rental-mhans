import React from "react";
import { describe, expect, it } from "vitest";
import { ProcessingDocument } from "../processing/ProcessingDocument";
import {
  collectText,
  processingFixtures,
  processingLong,
  processingNatural,
  processingEmpresa,
  renderToBufferForTest,
} from "../../__tests__/fixtures";
import { formatCLP } from "../../utils/formatters";

type Data = Parameters<typeof ProcessingDocument>[0]["data"];
const element = (data: Data) => React.createElement(ProcessingDocument, { data });
const text = (data: Data) => collectText(element(data)).join("|");

describe("ProcessingDocument render smoke", () => {
  for (const [name, data] of Object.entries(processingFixtures)) {
    it(`renders the "${name}" fixture to a valid PDF`, async () => {
      const buffer = await renderToBufferForTest(element(data));
      expect(buffer.subarray(0, 4).toString("latin1")).toBe("%PDF");
      expect(buffer.byteLength).toBeGreaterThan(10_000);
    }, 30_000);
  }

  it("spans several pages with the long fixture", async () => {
    const buffer = await renderToBufferForTest(element(processingLong));
    const pages = buffer.toString("latin1").match(/\/Type \/Page\b/g) ?? [];
    expect(pages.length).toBeGreaterThan(2);
  }, 30_000);
});

describe("ProcessingDocument copy", () => {
  it("prints the annex, signature block and client name", () => {
    const out = text(processingNatural);
    expect(out).toContain("Anexo de contrato");
    expect(out).toContain("EN REPRESENTACIÓN DE");
    expect(out).toContain("Mario Alberto Hans Salinas");
    expect(out).toContain(processingNatural.client.name);
    expect(out).toContain("Pedido #");
  });

  it("prints the reserve amount and never the total as reserve", () => {
    const out = collectText(element(processingNatural));
    const { reserve, total } = processingNatural.totals;
    expect(out).toContain(formatCLP(reserve));
    const idx = out.findIndex((t) => t.startsWith("Reserva"));
    expect(idx).toBeGreaterThan(-1);
    expect(out.slice(idx, idx + 4)).not.toContain(formatCLP(total));
  });

  it("states the annex dates and the reserve percentage", () => {
    const out = text(processingNatural);
    expect(out).toContain(processingNatural.annex.deliveryDate);
    expect(out).toContain("corresponde al 25% del valor total del arriendo");
  });

  it("adds company lines to the client signature only for empresa", () => {
    expect(text(processingEmpresa)).toContain("Productora Los Andes SpA");
    expect(text(processingEmpresa)).toContain("76.543.210-K");
    expect(text(processingNatural)).not.toContain("76.543.210-K");
  });

  it("prints the annex section titles verbatim", () => {
    const out = text(processingNatural);
    for (const title of [
      "Uso del equipo",
      "Multa por retraso",
      "Pago y reserva",
      "Legislación aplicable y notificaciones",
    ])
      expect(out).toContain(title);
    expect(out).toContain("OBLIGACIONES DE LAS PARTES");
  });
});
