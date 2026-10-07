import { describe, expect, it } from "vitest";
import {
  canPickUp,
  clientFinancial,
  clientKpis,
  clientValidation,
  clientValidationReport,
  REQUIREMENT_LABELS,
  missingDocuments,
  requiredDocuments,
  type ClientProfileLike,
} from "../clientStatus";

function profile(partial: Partial<ClientProfileLike> = {}): ClientProfileLike {
  return {
    tipoCliente: "natural",
    contractUrl: "https://r2/contrato.pdf",
    rutFrontUrl: "https://r2/a.jpg",
    rutBackUrl: "https://r2/b.jpg",
    signatureUrl: "https://r2/firma.png",
    companyErutUrl: null,
    termsAccepted: true,
    ...partial,
  };
}

/**
 * Qué documentos se le exigen a cada cliente. Depende del tipo: a una persona natural nunca se le
 * pide el E-RUT de empresa, y exigírselo dejaría a todos los particulares permanentemente
 * "incompletos", volviendo inútil el filtro.
 */
describe("requiredDocuments", () => {
  it("a una persona natural le pide contrato y carnet por ambos lados", () => {
    // La firma vive dentro del contrato firmado: no es un documento aparte que exigir.
    expect(requiredDocuments(profile())).toEqual([
      "rutFrontUrl",
      "rutBackUrl",
      "contractUrl",
    ]);
  });

  it("a una empresa le suma el E-RUT", () => {
    const docs = requiredDocuments(profile({ tipoCliente: "empresa" }));
    expect(docs).toContain("companyErutUrl");
    expect(docs).toHaveLength(4);
  });
});

describe("missingDocuments", () => {
  it("con todo entregado no falta nada", () => {
    expect(missingDocuments(profile())).toEqual([]);
  });

  it("nombra lo que falta", () => {
    expect(missingDocuments(profile({ rutBackUrl: null }))).toEqual([
      "rutBackUrl",
    ]);
  });

  it("no reporta el E-RUT ausente en una persona natural", () => {
    expect(missingDocuments(profile({ companyErutUrl: null }))).toEqual([]);
  });

  it("sí lo reporta en una empresa", () => {
    expect(missingDocuments(profile({ tipoCliente: "empresa" }))).toEqual([
      "companyErutUrl",
    ]);
  });
});

describe("clientValidation", () => {
  it("valida al cliente con todo entregado y términos aceptados", () => {
    expect(clientValidation(profile())).toBe("validado");
  });

  it("no valida si faltan los términos, aunque estén todos los documentos", () => {
    // El contrato es lo que la regla de retiro exige; un perfil sin términos no está listo.
    expect(clientValidation(profile({ termsAccepted: false }))).toBe(
      "pendiente",
    );
  });

  it("marca pendiente cuando lo único que falta es el contrato", () => {
    // Es el último paso del flujo y el que un admin persigue con un solo mensaje.
    expect(clientValidation(profile({ contractUrl: null }))).toBe("pendiente");
  });

  it("marca incompleto cuando falta un documento de identidad", () => {
    expect(clientValidation(profile({ rutFrontUrl: null }))).toBe("incompleto");
  });

  it("marca incompleto cuando faltan dos o más", () => {
    expect(
      clientValidation(profile({ contractUrl: null, rutBackUrl: null })),
    ).toBe("incompleto");
  });

  it("una empresa sin E-RUT no queda validada", () => {
    expect(clientValidation(profile({ tipoCliente: "empresa" }))).toBe(
      "incompleto",
    );
  });
});

describe("canPickUp", () => {
  it("solo el validado puede retirar", () => {
    expect(canPickUp(profile())).toBe(true);
    expect(canPickUp(profile({ contractUrl: null }))).toBe(false);
  });
});

describe("clientFinancial", () => {
  it("está al día sin saldo", () => {
    expect(clientFinancial({ outstanding: 0, hasOverdue: false })).toBe(
      "al-dia",
    );
  });

  it("un saldo aún no vencido es pago pendiente, no deuda", () => {
    // Juntar ambos pondría a todo arriendo en curso en la lista de morosos y volvería inservible
    // el único filtro que importa.
    expect(clientFinancial({ outstanding: 500_000, hasOverdue: false })).toBe(
      "pago-pendiente",
    );
  });

  it('reserva "con deuda" para lo vencido', () => {
    expect(clientFinancial({ outstanding: 500_000, hasOverdue: true })).toBe(
      "con-deuda",
    );
  });
});

describe("clientKpis", () => {
  it("reparte los clientes entre los tres estados", () => {
    const k = clientKpis([
      { profile: profile(), balance: { outstanding: 0, hasOverdue: false } },
      {
        profile: profile({ contractUrl: null }),
        balance: { outstanding: 0, hasOverdue: false },
      },
      {
        profile: profile({ rutFrontUrl: null }),
        balance: { outstanding: 0, hasOverdue: false },
      },
    ]);
    expect(k).toEqual({
      total: 3,
      validados: 1,
      pendientes: 1,
      incompletos: 1,
      conDeuda: 0,
    });
  });

  it("cuenta la deuda por separado del estado documental", () => {
    // Un cliente validado también puede deber: son dos ejes distintos.
    const k = clientKpis([
      { profile: profile(), balance: { outstanding: 100, hasOverdue: true } },
    ]);
    expect(k.validados).toBe(1);
    expect(k.conDeuda).toBe(1);
  });

  it("devuelve ceros sin clientes", () => {
    expect(clientKpis([])).toEqual({
      total: 0,
      validados: 0,
      pendientes: 0,
      incompletos: 0,
      conDeuda: 0,
    });
  });
});

/**
 * Matriz de la regla (2026-10-07): Validado = términos aceptados Y documentación requerida
 * (contrato firmado, carnet frontal y reverso, E-RUT si es empresa). Sin carnet (o sin E-RUT de
 * empresa) es Incompleto; con identidad completa pero falta contrato o términos es Pendiente.
 */
describe("clientValidationReport — matriz", () => {
  const cases: Array<{
    name: string;
    p: Partial<ClientProfileLike>;
    status: string;
    missing: string[];
  }> = [
    { name: "todo en regla", p: {}, status: "validado", missing: [] },
    {
      name: "sin términos",
      p: { termsAccepted: false },
      status: "pendiente",
      missing: ["terms"],
    },
    {
      name: "sin contrato",
      p: { contractUrl: null },
      status: "pendiente",
      missing: ["contract"],
    },
    {
      name: "sin términos ni contrato",
      p: { termsAccepted: false, contractUrl: null },
      status: "pendiente",
      missing: ["terms", "contract"],
    },
    {
      name: "sin carnet frontal",
      p: { rutFrontUrl: null },
      status: "incompleto",
      missing: ["idFront"],
    },
    {
      name: "sin carnet reverso",
      p: { rutBackUrl: null },
      status: "incompleto",
      missing: ["idBack"],
    },
    {
      name: "nada",
      p: {
        termsAccepted: false,
        contractUrl: null,
        rutFrontUrl: null,
        rutBackUrl: null,
      },
      status: "incompleto",
      missing: ["terms", "contract", "idFront", "idBack"],
    },
    {
      name: "empresa sin E-RUT",
      p: { tipoCliente: "empresa" },
      status: "incompleto",
      missing: ["erut"],
    },
    {
      name: "empresa con E-RUT",
      p: { tipoCliente: "empresa", companyErutUrl: "https://r2/erut.pdf" },
      status: "validado",
      missing: [],
    },
    {
      name: "natural sin firma sigue validada",
      p: { signatureUrl: null },
      status: "validado",
      missing: [],
    },
  ];

  it.each(cases)("$name", ({ p, status, missing }) => {
    const report = clientValidationReport(profile(p));
    expect(report.status).toBe(status);
    expect(report.missing.map((m) => m.key)).toEqual(missing);
    expect(report.status).toBe(clientValidation(profile(p)));
  });

  it("cada faltante trae su etiqueta en español", () => {
    const report = clientValidationReport(
      profile({ termsAccepted: false, rutFrontUrl: null }),
    );
    expect(report.missing.map((m) => m.label)).toEqual([
      REQUIREMENT_LABELS.terms,
      REQUIREMENT_LABELS.idFront,
    ]);
    expect(REQUIREMENT_LABELS.terms).toBe("Términos aceptados");
    expect(REQUIREMENT_LABELS.contract).toBe("Contrato firmado");
  });

  it("expone el listado completo con estado de cada requisito", () => {
    const report = clientValidationReport(profile({ contractUrl: null }));
    expect(report.requirements.map((r) => [r.key, r.met])).toEqual([
      ["terms", true],
      ["contract", false],
      ["idFront", true],
      ["idBack", true],
    ]);
  });
});
