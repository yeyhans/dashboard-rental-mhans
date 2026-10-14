import micromatch from "micromatch";

/**
 * Pages that require an admin session, enforced by `middleware/index.ts`.
 *
 * Kept in a pure module because the middleware imports `astro:middleware`, which vitest cannot
 * resolve; the list is covered by `lib/__tests__/protectedPages.test.ts`.
 *
 * `/contract-pdf/**` was added for B-1 (S1, audit 2026-10-14): the page rendered any customer's
 * contract to an anonymous visitor using the service-role key. `/budget-pdf` and `/order-pdf` are
 * not listed: they authorize per order owner in the page itself (`lib/pdfPageAuth.ts`).
 */
export const PROTECTED_PAGE_PATTERNS: readonly string[] = [
  "/dashboard(|/)",
  "/dashboard/**",
  "/orders/**",
  "/users/**",
  "/payments-table(|/)",
  "/products/**",
  "/analytics/**",
  "/delivery(|/)",
  "/check-in(|/)",
  "/finance(|/)",
  "/profitability(|/)",
  "/inventory(|/)",
  "/inventory/**",
  "/operators(|/)",
  "/bodega(|/)",
  "/bodega/**",
  "/contract-pdf/**",
];

export function isProtectedPage(pathname: string): boolean {
  return micromatch.isMatch(pathname, PROTECTED_PAGE_PATTERNS as string[]);
}
