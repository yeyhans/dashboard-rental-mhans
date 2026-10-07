import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/documentUploadService", () => ({
  uploadDocument: vi.fn(),
  updateUserProfileWithDocument: vi.fn(),
  getDocumentTypeName: vi.fn(() => ""),
}));

import {
  ClientRequirementsChecklist,
  ClientValidationBadge,
  missingSummary,
  isFullyComplete,
} from "../ClientValidation";
import UserTableView from "../UserTableView";
import type { UserProfile } from "../../../types/user";

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    user_id: 1,
    auth_uid: "auth-1",
    email: "ana@example.com",
    nombre: "Ana",
    apellido: "Pérez",
    rut: "11.111.111-1",
    usuario: "ana",
    direccion: "Calle 1",
    ciudad: "Santiago",
    pais: "Chile",
    telefono: "+56911111111",
    fecha_nacimiento: "1990-01-01",
    empresa_nombre: null,
    tipo_cliente: "natural",
    terminos_aceptados: true,
    url_user_contrato: "https://example.com/contrato.pdf",
    url_rut_anverso: "https://example.com/a.png",
    url_rut_reverso: "https://example.com/b.png",
    url_firma: "https://example.com/firma.png",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as UserProfile;
}

function table(user: UserProfile): string {
  return renderToStaticMarkup(
    <UserTableView
      users={[user]}
      onUserUpdated={vi.fn()}
      onViewDetails={vi.fn()}
      sessionToken="token"
    />,
  );
}

describe("missingSummary", () => {
  it("is empty for a validated client", () => {
    expect(missingSummary(makeUser())).toBe("");
  });

  it("lists what is missing in Spanish, lowercase after the first", () => {
    expect(
      missingSummary(
        makeUser({ terminos_aceptados: false, url_user_contrato: null }),
      ),
    ).toBe("Falta: términos aceptados, contrato firmado");
  });
});

describe("ClientValidationBadge", () => {
  it("explains the reason in a title for a non-validated client", () => {
    const html = renderToStaticMarkup(
      <ClientValidationBadge user={makeUser({ url_user_contrato: null })} />,
    );
    expect(html).toContain("Pendiente");
    expect(html).toContain('title="Falta: contrato firmado"');
  });

  it("says the requirements are met for a validated client", () => {
    const html = renderToStaticMarkup(
      <ClientValidationBadge user={makeUser()} />,
    );
    expect(html).toContain("Validado");
    expect(html).toContain('title="Términos y documentación al día"');
  });
});

describe("ClientRequirementsChecklist", () => {
  it("shows every applicable requirement with its state", () => {
    const html = renderToStaticMarkup(
      <ClientRequirementsChecklist
        user={makeUser({ terminos_aceptados: false })}
      />,
    );
    expect(html).toMatch(/Términos aceptados[\s\S]*Falta/);
    expect(html).toContain("Contrato firmado");
    expect(html).toContain("Carnet frontal");
    expect(html).toContain("Carnet reverso");
    expect(html).not.toContain("E-RUT");
  });

  it("adds the E-RUT row for a company", () => {
    const html = renderToStaticMarkup(
      <ClientRequirementsChecklist
        user={makeUser({ tipo_cliente: "empresa" })}
      />,
    );
    expect(html).toContain("E-RUT (empresa)");
  });
});

describe("UserTableView — reason and completion consistency (06.1)", () => {
  it("shows the missing items instead of the percentage for a non-validated client", () => {
    const html = table(makeUser({ url_user_contrato: null }));
    expect(html).toContain("Falta: contrato firmado");
    expect(html).not.toMatch(/Perfil \d+% completo/);
  });

  it("keeps the percentage for a validated client", () => {
    const html = table(makeUser());
    expect(html).toMatch(/Perfil 100% completo/);
    expect(html).toContain("Validado");
  });
});

describe("isFullyComplete", () => {
  it("is true only when the profile is 100% AND the client is validated", () => {
    expect(isFullyComplete(makeUser())).toBe(true);
  });

  it("is false for a 100% profile whose contract is missing", () => {
    expect(isFullyComplete(makeUser({ url_user_contrato: null }))).toBe(false);
  });
});
