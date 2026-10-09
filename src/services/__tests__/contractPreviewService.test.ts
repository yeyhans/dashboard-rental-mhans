import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../../lib/siteSettings";
import {
  buildContractPreview,
  validateContractPreviewInput,
} from "../contractPreviewService";

const NATURAL = {
  tipo_cliente: "natural",
  nombre: "Ana",
  apellido: "Pérez",
  rut: "12.345.678-5",
  direccion: "Calle 1 #23",
  ciudad: "Santiago",
  email: "ana@example.com",
};

describe("validateContractPreviewInput", () => {
  it("accepts a natural person and trims values", () => {
    const result = validateContractPreviewInput({
      ...NATURAL,
      nombre: "  Ana  ",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.nombre).toBe("Ana");
  });

  it("strips control characters", () => {
    const result = validateContractPreviewInput({
      ...NATURAL,
      nombre: "An\u0000a\u0007",
    });
    expect(result.ok && result.value.nombre).toBe("Ana");
  });

  it.each([
    ["non-object body", null],
    ["unknown tipo_cliente", { ...NATURAL, tipo_cliente: "otro" }],
    ["missing nombre", { ...NATURAL, nombre: "" }],
    ["bad RUT check digit", { ...NATURAL, rut: "12.345.678-9" }],
    ["too long direccion", { ...NATURAL, direccion: "x".repeat(300) }],
    ["bad email", { ...NATURAL, email: "nope" }],
    ["non-string field", { ...NATURAL, nombre: 5 }],
  ])("rejects %s", (_label, body) => {
    expect(validateContractPreviewInput(body).ok).toBe(false);
  });

  it("requires company data for empresa", () => {
    expect(
      validateContractPreviewInput({ ...NATURAL, tipo_cliente: "empresa" }).ok,
    ).toBe(false);
    expect(
      validateContractPreviewInput({
        ...NATURAL,
        tipo_cliente: "empresa",
        empresa_nombre: "Acme SpA",
        empresa_rut: "76.000.000-1",
      }).ok,
    ).toBe(false); // 76.000.000-1 has an invalid check digit
  });
});

describe("buildContractPreview", () => {
  const now = new Date("2026-10-02T15:00:00Z");

  function build(overrides: Record<string, unknown> = {}) {
    const parsed = validateContractPreviewInput({ ...NATURAL, ...overrides });
    if (!parsed.ok) throw new Error(parsed.error);
    return buildContractPreview(parsed.value, now, DEFAULT_SETTINGS);
  }

  it("returns the structured contract with tenant data resolved", () => {
    const preview = build();
    expect(preview.title).toMatch(/contrato/i);
    expect(preview.issuedOn).toBe("02/10/2026");
    expect(preview.parties[0]).toContain("Ana Pérez");
    expect(preview.parties[0]).toContain("12.345.678-5");
    expect(preview.clauses.length).toBeGreaterThan(5);
    expect(preview.clauses[0]).toMatchObject({ number: "PRIMERA" });
    expect(preview.clauses.every((c) => c.paragraphs.length > 0)).toBe(true);
    expect(preview.closing).toEqual(["Firma del arrendatario"]);
  });

  it("leaves no unresolved placeholders", () => {
    const text = JSON.stringify(build());
    expect(text).not.toMatch(/\{\{/);
  });

  it("uses the company as tenant for empresa", () => {
    const preview = build({
      tipo_cliente: "empresa",
      empresa_nombre: "Acme SpA",
      empresa_rut: "76.543.210-3",
    });
    expect(preview.parties[0]).toContain("Acme SpA");
  });
});
