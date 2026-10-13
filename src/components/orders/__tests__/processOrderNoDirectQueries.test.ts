import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

/**
 * T-05: ProcessOrder used to pull ShippingService (a service-role module) into the browser bundle
 * and query shipping_methods from the client. Reads now go through the protected /api routes.
 */
const source = readFileSync(
  path.resolve(__dirname, "../ProcessOrder.tsx"),
  "utf8",
);

describe("ProcessOrder data access", () => {
  it("never queries Supabase directly", () => {
    expect(source).not.toMatch(/\.from\(\s*["'`]/);
    expect(source).not.toMatch(/from\s+["'][^"']*lib\/supabase["']/);
  });

  it("does not import the server-side shipping service", () => {
    expect(source).not.toMatch(
      /from\s+["'][^"']*services\/shippingService["']/,
    );
  });
});
