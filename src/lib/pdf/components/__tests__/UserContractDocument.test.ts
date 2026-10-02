import React from "react";
import { describe, expect, it } from "vitest";
import { UserContractDocument } from "../contract/UserContractDocument";
import {
  collectText,
  contractFixtures,
  renderToBufferForTest,
} from "../../__tests__/fixtures";

const element = (data: (typeof contractFixtures)[string]) =>
  React.createElement(UserContractDocument, { data });

describe("UserContractDocument", () => {
  for (const [name, data] of Object.entries(contractFixtures)) {
    it(`renders the "${name}" fixture to a valid PDF`, async () => {
      const buffer = await renderToBufferForTest(element(data));
      expect(buffer.subarray(0, 4).toString("latin1")).toBe("%PDF");
      expect(buffer.byteLength).toBeGreaterThan(10_000);
    }, 60_000);

    it(`prints the contract copy for "${name}"`, () => {
      const out = collectText(element(data)).join("|");
      expect(out).toContain("CONTRATO DE ARRIENDO DE BIENES MUEBLES");
      expect(out).toContain("DÉCIMO SÉPTIMA");
      expect(out).toContain(data.signer.name);
      expect(out).toContain("8140915407");
      expect(out).not.toContain("306024355");
      expect(out).not.toContain("[fecha]");
      expect(out).not.toMatch(/DOCUMENTOS ADJUNTOS/i);
      expect(out).not.toMatch(/https?:\/\/media\./);
    });
  }
});
