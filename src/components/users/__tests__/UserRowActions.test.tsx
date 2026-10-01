import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// `UserDocumentUpload` -> `documentUploadService` -> `authService` -> `lib/supabase`, which throws
// at import time server-side without Supabase env vars (same reason other tests in this project
// mock the chain — see `CheckInBoard.test.tsx`).
vi.mock("../../../lib/documentUploadService", () => ({
  uploadDocument: vi.fn(),
  updateUserProfileWithDocument: vi.fn(),
  getDocumentTypeName: vi.fn(() => ""),
}));

import UserTableView from "../UserTableView";
import UserCardView from "../UserCardView";
import type { UserProfile } from "../../../types/user";

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
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as UserProfile;
}

describe("UserTableView row actions (D-09)", () => {
  it("shows a single 'Ver ficha' action instead of the four separate buttons", () => {
    const html = renderToStaticMarkup(
      <UserTableView
        users={[makeUser()]}
        onUserUpdated={vi.fn()}
        onViewDetails={vi.fn()}
        sessionToken="token"
      />,
    );
    expect(html).toContain("Ver ficha");
    expect(html).not.toContain("Ver detalles");
  });

  it("renders the row menu trigger that keeps Documentos, Editar and Contrato reachable", () => {
    // The Radix `DropdownMenu` content is portalled and closed by default, so a static-markup
    // render only ever shows the trigger — same convention as `RowActionsMenu.test.tsx`.
    const html = renderToStaticMarkup(
      <UserTableView
        users={[makeUser()]}
        onUserUpdated={vi.fn()}
        onViewDetails={vi.fn()}
        sessionToken="token"
      />,
    );
    expect(html).toContain('aria-label="Más acciones"');
  });
});

describe("UserCardView row actions (D-09)", () => {
  it("shows a single 'Ver ficha' action instead of the separate icon buttons", () => {
    const html = renderToStaticMarkup(
      <UserCardView
        users={[makeUser()]}
        onUserUpdated={vi.fn()}
        onViewDetails={vi.fn()}
        sessionToken="token"
      />,
    );
    expect(html).toContain("Ver ficha");
    expect(html).not.toContain("Ver detalles");
    expect(html).toContain('aria-label="Más acciones"');
  });
});
