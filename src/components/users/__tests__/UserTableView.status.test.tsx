import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Same mock chain as `UserRowActions.test.tsx`: the row dialogs pull in `lib/supabase`, which
// throws at import time server-side without Supabase env vars.
vi.mock("../../../lib/documentUploadService", () => ({
  uploadDocument: vi.fn(),
  updateUserProfileWithDocument: vi.fn(),
  getDocumentTypeName: vi.fn(() => ""),
}));

import UserTableView from "../UserTableView";
import type { UserProfile } from "../../../types/user";

const UsersDashboardSource = readFileSync(
  path.resolve(__dirname, "../../UsersDashboard.tsx"),
  "utf-8",
);

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    user_id: 1,
    auth_uid: "auth-1",
    email: "ana@example.com",
    nombre: "Ana",
    apellido: "Pérez",
    rut: "11.111.111-1",
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

function render(user: UserProfile): string {
  return renderToStaticMarkup(
    <UserTableView
      users={[user]}
      onUserUpdated={vi.fn()}
      onViewDetails={vi.fn()}
      sessionToken="token"
    />,
  );
}

describe("UserTableView — status badge (06.1)", () => {
  it("renders a fully validated client as a green dotted pill labelled Validado", () => {
    const html = render(makeUser());
    expect(html).toContain("Validado");
    expect(html).toContain("bg-[var(--color-ok-bg)]");
    expect(html).toContain("rounded-full");
  });

  it("renders a client missing only the contract as Pendiente (warn)", () => {
    const html = render(makeUser({ url_user_contrato: null }));
    expect(html).toContain("Pendiente");
    expect(html).toContain("bg-[var(--color-warn-bg)]");
  });

  it("renders a client missing documents as Incompleto (warn per canon)", () => {
    const html = render(
      makeUser({ url_rut_anverso: null, url_user_contrato: null }),
    );
    expect(html).toContain("Incompleto");
    expect(html).toContain("bg-[var(--color-warn-bg)]");
  });

  it("no longer uses the off-palette Tailwind status colours", () => {
    const html = render(makeUser());
    expect(html).not.toContain("bg-green-100");
    expect(html).not.toContain("bg-yellow-100");
    expect(html).not.toContain("bg-blue-100");
  });
});

describe("UserTableView — RUT and date cells (06.3)", () => {
  it("renders the RUT and the registration date in a no-wrap monospace cell", () => {
    const html = render(makeUser());
    expect(html).toMatch(
      /<td[^>]*font-mono[^>]*whitespace-nowrap[^>]*>11\.111\.111-1<\/td>/,
    );
    expect(html).toMatch(
      /<td[^>]*font-mono[^>]*whitespace-nowrap[^>]*>\d{2}-\d{2}-\d{4}<\/td>/,
    );
  });
});

describe("UsersDashboard — new client button (06.4)", () => {
  it('does not prefix "Nuevo Cliente" with a literal "+" next to the icon', () => {
    expect(UsersDashboardSource).not.toContain("+ Nuevo Cliente</");
    expect(UsersDashboardSource).not.toMatch(/\/>\s*\+\s*Nuevo Cliente/);
    expect(UsersDashboardSource).toContain("Nuevo Cliente");
  });
});
