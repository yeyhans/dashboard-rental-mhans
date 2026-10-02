import { describe, expect, it } from "vitest";
import { buildUserContractData } from "../contractData";
import { buildContractCopy } from "../../content/contractCopy";

const NOW = new Date("2026-10-02T15:00:00Z");

const natural = {
  user_id: 7,
  nombre: "Camila",
  apellido: "Rojas",
  email: "camila@x.cl",
  rut: "12.345.678-5",
  direccion: "Av. Siempre Viva 123",
  ciudad: "Providencia",
  tipo_cliente: "natural",
  url_firma: "https://media.mariohans.cl/firmas/camila.png",
};
const empresa = {
  ...natural,
  tipo_cliente: "empresa",
  empresa_nombre: "Productora Los Andes SpA",
  empresa_rut: "76.543.210-K",
  empresa_direccion: "Los Leones 99",
  empresa_ciudad: "Ñuñoa",
  url_firma: undefined,
};

const strings = (value: unknown): string[] =>
  typeof value === "string"
    ? [value]
    : Array.isArray(value)
      ? value.flatMap(strings)
      : value && typeof value === "object"
        ? Object.values(value).flatMap(strings)
        : [];

describe("buildUserContractData", () => {
  it("formats the issue date in long Spanish form", () => {
    expect(buildUserContractData(natural, NOW).issueDateLong).toBe(
      "2 de octubre de 2026",
    );
  });

  it("maps a natural client", () => {
    const data = buildUserContractData(natural, NOW);
    expect(data.isCompany).toBe(false);
    expect(data.subtitle).toBe("persona natural");
    expect(data.signer).toEqual({
      name: "Camila Rojas",
      cedula: "Cédula de identidad nacional N° 12.345.678-5",
    });
    expect(data.signatureImageUrl).toBe(natural.url_firma);
    expect(data.tenant.address).toBe("Av. Siempre Viva 123, Providencia");
  });

  it("maps an empresa client with company address and no signature", () => {
    const data = buildUserContractData(empresa, NOW);
    expect(data.isCompany).toBe(true);
    expect(data.subtitle).toBe("persona jurídica");
    expect(data.tenant.address).toBe("Los Leones 99, Ñuñoa");
    expect(data.signer.company).toBe("Productora Los Andes SpA");
    expect(data.signer.companyRut).toBe("RUT N° 76.543.210-K");
    expect(data.signatureImageUrl).toBeUndefined();
  });

  it("falls back to the personal address when the company has none", () => {
    const data = buildUserContractData(
      { ...empresa, empresa_direccion: "", empresa_ciudad: "" },
      NOW,
    );
    expect(data.tenant.address).toBe("Av. Siempre Viva 123, Providencia");
  });
});

describe("buildContractCopy", () => {
  it("resolves every placeholder for both variants", () => {
    for (const profile of [natural, empresa]) {
      const copy = buildContractCopy(buildUserContractData(profile, NOW));
      for (const s of strings(copy)) expect(s).not.toMatch(/\[|\]|\{\{/);
    }
  });

  it("uses the HTML wording for empresa", () => {
    const { comparecencia } = buildContractCopy(
      buildUserContractData(empresa, NOW),
    );
    expect(comparecencia).toContain("En Santiago de Chile, a 2 de octubre de 2026");
    expect(comparecencia).toContain(
      "Productora Los Andes SpA, Rol Único Tributario N° 76.543.210-K, representada legalmente por Camila Rojas, cédula de identidad nacional N° 12.345.678-5, ambos con domicilio en Los Leones 99, Ñuñoa",
    );
  });

  it("uses the derived wording for natural clients", () => {
    const { comparecencia } = buildContractCopy(
      buildUserContractData(natural, NOW),
    );
    expect(comparecencia).toContain(
      "y por la otra, Camila Rojas, cédula de identidad nacional N° 12.345.678-5, con domicilio en Av. Siempre Viva 123, Providencia, en adelante",
    );
    expect(comparecencia).not.toContain("representada legalmente por Camila");
  });

  it("prints the current bank data and the notification emails", () => {
    const copy = buildContractCopy(buildUserContractData(natural, NOW));
    const all = strings(copy).join("|");
    expect(all).toContain("8140915407");
    expect(all).toContain("Cuenta Corriente");
    expect(all).not.toContain("306024355");
    expect(all).toContain("PARTE ARRENDADORA: rental.mariohans@gmail.com");
    expect(all).toContain("PARTE ARRENDATARIA: camila@x.cl");
  });

  it("has 17 clauses ending with DÉCIMO SÉPTIMA", () => {
    const { clauses } = buildContractCopy(buildUserContractData(natural, NOW));
    expect(clauses).toHaveLength(17);
    expect(clauses[16]!.number).toBe("DÉCIMO SÉPTIMA");
  });
});
