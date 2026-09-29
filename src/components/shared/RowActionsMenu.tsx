import type { ComponentType } from "react";
import { MoreVertical } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { rowActionItemClass } from "./rowActionItemStyle";
import { rowActionKey } from "./rowActionKey";

export interface RowActionItem {
  /** Optional stable identity (e.g. the action name). Falls back to `index-label` when absent. */
  id?: string | number;
  label: string;
  onSelect: () => void;
  icon?: ComponentType<{ className?: string }>;
  destructive?: boolean;
  disabled?: boolean;
}

interface RowActionsMenuProps {
  items: RowActionItem[];
  /** Accessible label for the ⋮ trigger. Defaults to the canonical "Más acciones". */
  label?: string;
}

/**
 * Shared row-actions menu (D-03, canonical pattern P9): a single ⋮ trigger replacing the
 * per-row "Editar"/"Eliminar" icon pairs and "Ver detalles" links across D-05..D-09.
 */
export function RowActionsMenu({
  items,
  label = "Más acciones",
}: RowActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem
              key={rowActionKey(item, index)}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={rowActionItemClass({ destructive: item.destructive })}
            >
              {Icon && <Icon className="mr-2 h-4 w-4" />}
              {item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
