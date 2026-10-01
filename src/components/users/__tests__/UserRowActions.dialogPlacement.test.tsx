import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * D-18: proves the row-menu dialogs (Documentos/Editar/Contrato) no longer live inside
 * `DropdownMenuContent`.
 *
 * Radix's `DropdownMenuContent` is not `forceMount`ed, so with the menu closed (the default,
 * untouched state on every render) it renders none of its children at all — a project convention
 * already relied on by `UserRowActions.test.tsx` ("the Radix DropdownMenu content is portalled
 * and closed by default"). Before D-18, `UserDocumentUpload`/`EditUserDialog`/
 * `RegenerateContractDialog` were mounted AS children of `DropdownMenuContent`, so with the menu
 * closed they were never even instantiated — which is exactly why a dialog opened by a menu click
 * vanished the instant Radix's own close animation unmounted the menu.
 *
 * Mocking the three dialogs out lets this be observed without simulating a click (this project
 * has no jsdom/testing-library): if they are still nested inside `DropdownMenuContent`, the mocks
 * are never called with the menu closed. If they are siblings of the `DropdownMenu` — controlled
 * by the view's own row state, per D-18 — the mocks are always called, and with the `open`/
 * `onOpenChange` pair that makes them controllable.
 */
vi.mock("../../EditUserDialog", () => ({
  default: vi.fn(() => null),
}));
vi.mock("../UserDocumentUpload", () => ({
  default: vi.fn(() => null),
}));
vi.mock("../RegenerateContractDialog", () => ({
  default: vi.fn(() => null),
}));

import UserTableView from "../UserTableView";
import UserCardView from "../UserCardView";
import EditUserDialog from "../../EditUserDialog";
import UserDocumentUpload from "../UserDocumentUpload";
import RegenerateContractDialog from "../RegenerateContractDialog";
import type { UserProfile } from "../../../types/user";

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    user_id: 7,
    auth_uid: "auth-7",
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

describe.each([
  ["UserTableView", UserTableView],
  ["UserCardView", UserCardView],
])("%s row dialogs (D-18)", (_name, View: any) => {
  it("instantiates all three dialogs even though the row menu is closed by default", () => {
    (EditUserDialog as any).mockClear();
    (UserDocumentUpload as any).mockClear();
    (RegenerateContractDialog as any).mockClear();

    renderToStaticMarkup(
      <View
        users={[makeUser()]}
        onUserUpdated={vi.fn()}
        onViewDetails={vi.fn()}
        sessionToken="token"
      />,
    );

    // A dialog nested inside the (closed, default) DropdownMenuContent would never be called —
    // its parent renders nothing. Being called at all proves it is a sibling, not a child.
    expect(UserDocumentUpload).toHaveBeenCalledTimes(1);
    expect(EditUserDialog).toHaveBeenCalledTimes(1);
    expect(RegenerateContractDialog).toHaveBeenCalledTimes(1);
  });

  it("controls each dialog with the row's own open/onOpenChange, not a self-managed trigger", () => {
    (EditUserDialog as any).mockClear();
    (UserDocumentUpload as any).mockClear();
    (RegenerateContractDialog as any).mockClear();

    renderToStaticMarkup(
      <View
        users={[makeUser()]}
        onUserUpdated={vi.fn()}
        onViewDetails={vi.fn()}
        sessionToken="token"
      />,
    );

    for (const mock of [
      UserDocumentUpload,
      EditUserDialog,
      RegenerateContractDialog,
    ] as any[]) {
      const props = mock.mock.calls[0][0];
      expect(typeof props.open).toBe("boolean");
      expect(props.open).toBe(false); // closed until a menu item is picked
      expect(typeof props.onOpenChange).toBe("function");
    }
  });
});
