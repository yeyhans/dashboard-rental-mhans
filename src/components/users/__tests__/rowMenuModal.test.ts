import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, it, expect } from "vitest";

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf-8");

// D-19: the row menu closes while a modal Dialog opens in the same tick. Two modal Radix layers
// handing off can leave `pointer-events: none` on <body>; the row menu must be non-modal.
describe("D-19: Clientes row menu is non-modal", () => {
  it.each(["../UserTableView.tsx", "../UserCardView.tsx"])("%s", (file) => {
    expect(read(file)).toMatch(/<DropdownMenu modal=\{false\}>/);
  });
});
