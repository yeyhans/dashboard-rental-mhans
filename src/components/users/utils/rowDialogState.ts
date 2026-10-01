/**
 * D-18: which row-menu dialog is currently open in `UserTableView`/`UserCardView`.
 *
 * Documentos/Editar/Contrato used to be mounted INSIDE `DropdownMenuContent`, each with its own
 * `useState`. Radix unmounts `DropdownMenuContent` the instant the menu closes (it is not
 * `forceMount`ed), which unmounted the dialog along with it — the item click that was supposed to
 * open the dialog instead made it flash and disappear as soon as the menu's own close animation
 * ran. Tracking "which dialog, for which user" once per view (instead of once per dialog) is what
 * lets the three dialogs be rendered as siblings of the `DropdownMenu`, independent of whether the
 * menu itself is open or closed.
 */

export type RowDialogKind = "documents" | "edit" | "contract";

export interface ActiveRowDialog {
  userId: number;
  kind: RowDialogKind;
}

export function openRowDialog(
  userId: number,
  kind: RowDialogKind,
): ActiveRowDialog {
  return { userId, kind };
}

export function closeRowDialog(): null {
  return null;
}

export function isRowDialogOpen(
  active: ActiveRowDialog | null,
  userId: number,
  kind: RowDialogKind,
): boolean {
  return active !== null && active.userId === userId && active.kind === kind;
}
