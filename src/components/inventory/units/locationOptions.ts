import { describeLocation, type LocationTreeNode } from "../../../lib/warehouseLocations";

/** One `<option>` of the location select; `depth` indents levels and boxes under their shelf. */
export interface LocationOption {
  id: string;
  code: string;
  label: string;
  depth: number;
}

/** Depth-first, keeping the tree's sibling order (by code). */
export function flattenLocationTree(tree: readonly LocationTreeNode[]): LocationOption[] {
  const options: LocationOption[] = [];
  const visit = (nodes: readonly LocationTreeNode[], depth: number) => {
    for (const node of nodes) {
      options.push({ id: node.id, code: node.code, label: describeLocation(node), depth });
      visit(node.children, depth + 1);
    }
  };
  visit(tree, 0);
  return options;
}

/** Indent with non-breaking spaces: native `<option>` ignores padding. */
export function indentedLabel(option: LocationOption): string {
  return `${"   ".repeat(option.depth)}${option.label}`;
}
