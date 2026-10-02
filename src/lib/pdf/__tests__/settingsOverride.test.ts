import React from "react";
import { describe, expect, it } from "vitest";
import { BudgetDocument } from "../components/budget/BudgetDocument";
import { ProcessingDocument } from "../components/processing/ProcessingDocument";
import { UserContractDocument } from "../components/contract/UserContractDocument";
import { collectText } from "./fixtures";
import {
  DEFAULT_ONLY_STRINGS,
  budgetOverride,
  contractOverride,
  processingOverride,
  settingsOverride,
} from "./fixtures";

const render = (element: React.ReactElement) => collectText(element).join("|");

function expectOverridden(out: string, opts: { clauses?: boolean } = {}) {
  expect(out).toContain("Luz y Cámara Rental SpA");
  expect(out).toContain("99887766");
  expect(out).toContain("Banco Estado");
  expect(out).toContain("Cuenta Vista");
  expect(out).toContain("pagos@luzcamara.cl");
  for (const forbidden of DEFAULT_ONLY_STRINGS)
    expect(out, `default value leaked: ${forbidden}`).not.toContain(forbidden);
  if (opts.clauses) expect(out).toContain("30%");
}

describe("settings override flows into the PDFs", () => {
  it("budget prints the overridden bank, acceptance, footer and reserve", () => {
    const out = render(
      React.createElement(BudgetDocument, { data: budgetOverride }),
    );
    expectOverridden(out);
    expect(out).toContain(
      "Con el abono de reserva 30% aceptas las condiciones de Luz y Cámara.",
    );
    expect(out).toContain(
      "Retiro y devolución según lo coordinado con Luz y Cámara Rental.",
    );
    expect(out).toContain("Reserva 30%");
    expect(out).not.toContain("Retiro el día anterior");
  });

  it("processing prints the overridden annex addresses, reserve and signer block", () => {
    const out = render(
      React.createElement(ProcessingDocument, { data: processingOverride }),
    );
    expectOverridden(out);
    expect(out).toContain(
      "Av. Italia 1500, Ñuñoa o Los Leones 300, Providencia",
    );
    expect(out).toContain("corresponde al 30% del valor total del arriendo");
    expect(out).toContain("Valentina Paz Orrego Díaz");
    expect(out).toContain("15.222.333-4");
    expect(out).toContain("76.111.222-3");
  });

  it("contract prints the overridden comparecencia, QUINTA and notification e-mail", () => {
    const out = render(
      React.createElement(UserContractDocument, { data: contractOverride }),
    );
    expectOverridden(out, { clauses: true });
    expect(out).toContain(
      "representada legalmente por Valentina Paz Orrego Díaz",
    );
    expect(out).toContain("Av. Italia 1500, Ñuñoa");
    expect(out).toContain("correspondiente al 70% del valor total");
    expect(out).toContain("PARTE ARRENDADORA: hola@luzcamara.cl");
    expect(out).toContain("https://luzcamara.cl");
    expect(out).not.toContain("https://rental.mariohans.cl");
    expect(out).not.toContain("Lastarria");
  });

  it("carries the representative signature to the contract data", () => {
    expect(contractOverride.landlord.signatureUrl).toBe(
      settingsOverride.representative.signatureUrl,
    );
  });
});
