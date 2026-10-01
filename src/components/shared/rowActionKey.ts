export interface RowActionKeySource {
  id?: string | number;
  label: string;
}

/**
 * Stable React key for one `RowActionsMenu` item, extracted as a pure function for the same
 * reason as `rowActionItemClass` — see `__tests__/rowActionItemStyle.test.ts`. Prefers the
 * caller-provided `id`; falls back to `index-label` so two items sharing a label (e.g. two
 * "Editar" actions with different destructive-ness) never collide on the plain label alone.
 */
export function rowActionKey(item: RowActionKeySource, index: number): string {
  if (item.id !== undefined && item.id !== null) {
    return String(item.id);
  }
  return `${index}-${item.label}`;
}
