import { useState } from "react";

/**
 * D-18: lets a Dialog-wrapping component (`EditUserDialog`, `RegenerateContractDialog`,
 * `UserDocumentUpload`) be driven either uncontrolled (its own `useState`, the original
 * behavior — a caller passes only `trigger`) or controlled by a parent (`open`/`onOpenChange`
 * passed, the parent decides when it is open — needed so the dialog can be rendered outside a
 * `DropdownMenuContent` that would otherwise unmount it when the menu closes).
 */
export function useControllableOpen(
  controlledOpen: boolean | undefined,
  onOpenChange: ((open: boolean) => void) | undefined,
  initial = false,
): [boolean, (open: boolean) => void, boolean] {
  const [internalOpen, setInternalOpen] = useState(initial);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    onOpenChange?.(value);
    if (!isControlled) setInternalOpen(value);
  };
  return [open, setOpen, isControlled];
}
