import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * R-07: "Delivery es la palabra asignada para el móvil del rental". User-visible copy in the
 * dashboard says "Delivery" where it means the rental's vehicle service, never "envío(s)" or
 * "despacho(s)". Code identifiers, DB columns and API fields keep their names; logs and comments
 * are not UI and are skipped.
 *
 * Intentional uses are listed in ALLOWLIST with the reason. Verbs ("despachar", "despachado") are
 * not nouns for the service and are not matched.
 */
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** [file relative to src/, exact text that may stay, why]. */
const ALLOWLIST: ReadonlyArray<readonly [string, string, string]> = [
  [
    "components/orders/ProcessOrder.tsx",
    "Envío de Correos al Cliente",
    "sending emails, not the vehicle service",
  ],
  // Customer-facing PDF documents: same family as the email templates, outside R-07.
  [
    "pages/budget-pdf/[orderId].astro",
    "Método de envío",
    "client PDF document",
  ],
  ["pages/budget-pdf/[orderId].astro", "Envío", "client PDF document"],
  ["pages/order-pdf/[orderId].astro", "Método de envío", "client PDF document"],
  ["pages/order-pdf/[orderId].astro", "Envío", "client PDF document"],
  // SVG layer name inside the PDF artwork, not copy.
  ["pages/budget-pdf/[orderId].astro", "Envio RM", "SVG layer name"],
  ["pages/order-pdf/[orderId].astro", "Envio RM", "SVG layer name"],
];

const NOUN = /(?<![\p{L}\p{N}_])(env[ií]os?|despachos?)(?![\p{L}\p{N}_])/giu;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== "__tests__") walk(full, out);
    } else out.push(full);
  }
  return out;
}

/** Comments and log lines are not UI copy; blank them, keeping line numbers. */
function uiText(source: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, " ");
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/^\s*\/\/.*$/gm, blank)
    .replace(/^.*console\.(log|warn|error|info|debug)\(.*$/gm, blank);
}

function findings(): string[] {
  const files = [
    ...walk(path.join(SRC, "components")).filter((f) => f.endsWith(".tsx")),
    ...walk(path.join(SRC, "pages")).filter((f) => f.endsWith(".astro")),
  ];
  const out: string[] = [];
  for (const file of files) {
    const rel = path.relative(SRC, file).split(path.sep).join("/");
    const allowed = ALLOWLIST.filter(([f]) => f === rel).map(
      ([, text]) => text,
    );
    uiText(readFileSync(file, "utf8"))
      .split("\n")
      .forEach((line, index) => {
        let rest = line;
        for (const text of allowed) rest = rest.split(text).join("");
        for (const match of rest.matchAll(NOUN)) {
          out.push(
            `${rel}:${index + 1} "${match[0]}" — ${line.trim().slice(0, 100)}`,
          );
        }
      });
  }
  return out;
}

describe("Delivery wording (R-07)", () => {
  it("UI copy says Delivery, not envío/despacho", () => {
    expect(findings()).toEqual([]);
  });

  it("does not match code identifiers such as con_envios or Envio_RM", () => {
    expect("con_envios Envio_RM".match(NOUN)).toBeNull();
    expect("Costo de envío".match(NOUN)).toEqual(["envío"]);
  });
});
