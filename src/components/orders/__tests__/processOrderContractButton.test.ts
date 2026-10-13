import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

/**
 * The "Generar contrato" button used `generateOrderProcessingPdfFromId`, a helper that read the
 * order with the browser's anon Supabase client and then called the PDF route by an absolute
 * `PUBLIC_SITE_URL`. The route now requires an admin session, so the button calls it same-origin
 * with the session cookie and lets the server read the order.
 */
const source = readFileSync(
  path.resolve(__dirname, "../ProcessOrder.tsx"),
  "utf8",
);

describe("ProcessOrder contract button", () => {
  it("calls the protected route same-origin with the session cookie", () => {
    expect(source).toMatch(
      /fetch\(\s*["']\/api\/order\/generate-processing-pdf["'],\s*\{[\s\S]{0,200}credentials:\s*["']include["']/,
    );
  });

  it("no longer reads the order through the browser helper", () => {
    expect(source).not.toContain("generateOrderProcessingPdfFromId");
  });
});
