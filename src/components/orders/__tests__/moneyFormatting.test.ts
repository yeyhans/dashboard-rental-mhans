import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * T-19 (b): every money amount shows es-CL thousands separators. A JSX `${order.calculated_total}`
 * prints the raw database value ("$214200"); amounts must go through a formatter instead.
 */
const COMPONENT_DIRS = ["orders", "products", "users"].map((dir) =>
  path.resolve(__dirname, "../..", dir),
);

// `$` followed by a bare property access (optionally `a || b`), outside a template literal.
const RAW_MONEY = /\$\{[A-Za-z_][\w.?]*(\s*\|\|\s*[\w.?]+)*\}/;

function componentFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      return name === "__tests__" ? [] : componentFiles(full);
    }
    return name.endsWith(".tsx") ? [full] : [];
  });
}

describe("money formatting in components (T-19b)", () => {
  it("never prints a raw amount after a $ sign", () => {
    const offenders = COMPONENT_DIRS.flatMap(componentFiles).flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => !line.includes("`") && RAW_MONEY.test(line))
        .map(
          ({ line, index }) =>
            `${path.basename(file)}:${index + 1}: ${line.trim()}`,
        ),
    );
    expect(offenders).toEqual([]);
  });

  it("formats the order detail total with the shared CLP formatter", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../ProcessOrder.tsx"),
      "utf8",
    );
    expect(source).toContain("formatCLP(");
    expect(source).not.toContain(
      "${orderData.calculated_total || orderData.total}",
    );
  });
});
