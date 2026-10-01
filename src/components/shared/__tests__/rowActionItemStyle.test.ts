import { describe, expect, it } from "vitest";
import { rowActionItemClass } from "../rowActionItemStyle";

/**
 * `RowActionsMenu` itself wraps Radix's `DropdownMenu`, whose item list only renders once opened
 * (it is portalled and closed by default), so a static-markup render of the closed menu cannot
 * exercise it. The one piece of real logic — how a destructive item is styled — is extracted here
 * as a pure function so it is still covered by a real unit test.
 */
describe("rowActionItemClass", () => {
  it("marks a destructive item with the destructive text color", () => {
    expect(rowActionItemClass({ destructive: true })).toContain(
      "text-destructive",
    );
  });

  it("leaves a regular item without the destructive class", () => {
    expect(rowActionItemClass({})).not.toContain("text-destructive");
  });
});
