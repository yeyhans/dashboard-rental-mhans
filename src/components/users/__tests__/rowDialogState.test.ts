import { describe, expect, it } from "vitest";
import {
  isRowDialogOpen,
  openRowDialog,
  closeRowDialog,
} from "../utils/rowDialogState";

/**
 * D-18: which row-menu dialog (Documentos/Editar/Contrato) is open, tracked once per view
 * (`UserTableView`/`UserCardView`) instead of per dialog instance — this is the state that lets
 * the dialogs be rendered as siblings of the `DropdownMenu`, controlled from here, instead of
 * mounted inside `DropdownMenuContent` where Radix unmounts them the moment the menu closes.
 */
describe("rowDialogState", () => {
  it("starts closed for every user and kind", () => {
    expect(isRowDialogOpen(null, 1, "documents")).toBe(false);
  });

  it("opens exactly the (userId, kind) pair that was requested", () => {
    const active = openRowDialog(1, "edit");
    expect(isRowDialogOpen(active, 1, "edit")).toBe(true);
  });

  it("does not report open for a different user with the same dialog kind", () => {
    const active = openRowDialog(1, "edit");
    expect(isRowDialogOpen(active, 2, "edit")).toBe(false);
  });

  it("does not report open for the same user with a different dialog kind", () => {
    const active = openRowDialog(1, "edit");
    expect(isRowDialogOpen(active, 1, "documents")).toBe(false);
    expect(isRowDialogOpen(active, 1, "contract")).toBe(false);
  });

  it("closes to a state where nothing is open", () => {
    const closed = closeRowDialog();
    expect(isRowDialogOpen(closed, 1, "edit")).toBe(false);
    expect(closed).toBeNull();
  });
});
