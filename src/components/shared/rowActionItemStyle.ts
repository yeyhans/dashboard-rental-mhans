import { cn } from "../../lib/utils";

export interface RowActionItemStyle {
  destructive?: boolean;
}

/**
 * Class for one row-action menu item, extracted as a pure function so the one piece of real
 * logic (destructive styling) is unit-testable without opening the Radix dropdown it lives in —
 * see the note in `__tests__/rowActionsMenu.test.ts`.
 */
export function rowActionItemClass({
  destructive,
}: RowActionItemStyle): string {
  return cn(destructive && "text-destructive focus:text-destructive");
}
