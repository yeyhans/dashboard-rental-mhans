import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { isProtectedPage } from "../protectedPages";

/**
 * B-1 (S1, pre-cutover audit 2026-10-14): `/contract-pdf/[userId]` rendered any customer's
 * contract (name, RUT, address, e-mail) to an anonymous visitor, reading `user_profiles` with the
 * service-role key, and accepted a POST body as a substitute for the database read. The page list
 * lives in `lib/protectedPages.ts` because `middleware/index.ts` imports `astro:middleware`, which
 * vitest cannot resolve.
 */
describe("isProtectedPage", () => {
  it.each(["/contract-pdf/42", "/contract-pdf/42.pdf", "/contract-pdf/abc"])(
    "requires an admin session for %s",
    (pathname) => {
      expect(isProtectedPage(pathname)).toBe(true);
    },
  );

  it.each([
    "/dashboard",
    "/dashboard/",
    "/orders/1",
    "/users/9",
    "/bodega",
    "/inventory/units",
  ])("keeps the existing protected page %s", (pathname) => {
    expect(isProtectedPage(pathname)).toBe(true);
  });

  it.each(["/", "/login", "/api/auth/login"])(
    "leaves %s public",
    (pathname) => {
      expect(isProtectedPage(pathname)).toBe(false);
    },
  );
});

describe("contract-pdf page — source assertions", () => {
  const source = readFileSync(
    path.resolve(__dirname, "../../pages/contract-pdf/[userId].astro"),
    "utf-8",
  );
  const frontmatter = source.split("---")[1] ?? "";

  it("checks the admin session in the page itself (defense in depth)", () => {
    expect(frontmatter).toContain("getServerAdmin(Astro)");
    expect(frontmatter).toContain("hasFullAccess");
  });

  it("no longer renders attacker-supplied data from a POST body", () => {
    expect(frontmatter).not.toContain("request.method === 'POST'");
    expect(frontmatter).not.toContain("body.userData");
  });

  it("does not build its own service-role client from env", () => {
    expect(frontmatter).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("does not log customer PII", () => {
    expect(frontmatter).not.toMatch(/console\.log\([^)]*rut/);
  });
});
