import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

/**
 * T-12: ProcessOrder shipped well over a hundred console.log calls to the browser, several of
 * them printing order, customer and shipping data. Only console.error for real failures stays.
 */
const source = readFileSync(
  path.resolve(__dirname, "../ProcessOrder.tsx"),
  "utf8",
);

describe("ProcessOrder debug logging", () => {
  it("has no console.log, console.info, console.debug or console.warn calls", () => {
    expect(source).not.toMatch(/console\.(log|info|debug|warn)\s*\(/);
  });
});
