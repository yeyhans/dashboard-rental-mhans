import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * B-2 sweep (audit 2026-10-14): every exported handler under `src/pages/api/**` must be guarded.
 *
 * A handler passes when its export line wraps it in `withAuth` / `requireRole`, or when it is
 * listed below with the reason it does not need a session. Each listed kind is checked against the
 * file's source so the exemption cannot outlive the guard it describes. A new route that is not
 * wrapped and not listed fails this test.
 *
 * `OPTIONS` is exempt everywhere: the global middleware answers preflights for `/api/*`.
 */
type Exemption =
  /** `X-API-Key` compared in constant time (frontend server or Hermes), optionally or-admin. */
  | "apiKey"
  /** `Authorization: Bearer <CRON_SECRET>`, constant-time compare. */
  | "cron"
  /** Login / logout / refresh / session probe: reachable before a session exists. */
  | "authFlow"
  /** Public catalog or health data, no customer data. */
  | "public"
  /** Answers 405 and reads nothing. */
  | "notAllowed"
  /** Re-exports or calls a handler that is itself wrapped in `withAuth`. */
  | "delegates"
  /** Only served in `astro dev`, and wrapped in `withAuth` there. */
  | "devOnly";

const EXEMPT: Record<string, Partial<Record<string, Exemption>>> = {
  "/api/auth/login.ts": { POST: "authFlow" },
  "/api/auth/logout.ts": { GET: "authFlow", POST: "authFlow" },
  "/api/auth/refresh.ts": { POST: "authFlow" },
  "/api/auth/session.ts": { GET: "authFlow" },
  "/api/signin.ts": { POST: "authFlow" },
  "/api/signout.ts": { POST: "authFlow" },

  "/api/budget/generate-pdf.ts": { POST: "apiKey" },
  "/api/contracts/generate-pdf.ts": { POST: "apiKey" },
  "/api/emails/send-budget-notification.ts": { POST: "apiKey" },
  "/api/emails/send-order-completed-notification.ts": { POST: "apiKey" },
  "/api/emails/send-order-failed-notification.ts": { POST: "apiKey" },
  "/api/order/generate-budget-pdf.ts": { POST: "apiKey" },
  "/api/orders/index.ts": { POST: "apiKey" },
  "/api/external/consents/record.ts": { POST: "apiKey" },
  "/api/external/consents/status.ts": { POST: "apiKey" },
  "/api/external/contract-preview.ts": { POST: "apiKey" },
  "/api/external/create-user.ts": { POST: "apiKey" },
  "/api/external/generate-budget-pdf.ts": { POST: "apiKey" },
  "/api/external/generate-contract-pdf.ts": { POST: "apiKey" },
  "/api/external/inventory/units/[id].ts": { PUT: "apiKey" },
  "/api/external/inventory/units/index.ts": { POST: "apiKey" },
  "/api/external/products/[id]/description.ts": { PUT: "apiKey" },
  "/api/external/site-settings.ts": { GET: "apiKey" },
  "/api/external/update-user.ts": { POST: "apiKey" },

  "/api/cron/rentals-to-return.ts": { POST: "cron" },

  "/api/categories/index.ts": { GET: "public" },
  "/api/health.ts": { GET: "public" },

  "/api/dashboard/filtered.ts": { GET: "notAllowed" },
  "/api/orders/check-conflicts.ts": {
    GET: "notAllowed",
    PUT: "notAllowed",
    DELETE: "notAllowed",
  },
  "/api/orders/[id]/delete-pdf.ts": {
    GET: "notAllowed",
    POST: "notAllowed",
    PUT: "notAllowed",
  },
  "/api/products/batch.ts": {
    GET: "notAllowed",
    PUT: "notAllowed",
    DELETE: "notAllowed",
  },

  "/api/orders/status/[id].ts": { PUT: "delegates" },
  "/api/orders/update/[id].ts": { PATCH: "delegates" },

  "/api/coupons/debug.ts": { GET: "devOnly" },
};

/**
 * The MCP key check must run before the body is read: a route that touches the request first and
 * checks the key later could still do work for an unauthenticated caller.
 */
function mcpKeyCheckedBeforeBody(source: string): boolean {
  const guard = source.indexOf("validateMcpApiKey(");
  if (guard < 0) return false;
  const body = source.search(/request\.(json|text|formData|arrayBuffer)\(/);
  return body < 0 || guard < body;
}

const EVIDENCE: Record<Exemption, (source: string) => boolean> = {
  apiKey: (s) =>
    /isFrontendApiKeyOrAdmin\(|validateFrontendApiKey\(/.test(s) ||
    (/HERMES_API_SECRET/.test(s) && /secretsMatch\(/.test(s)) ||
    mcpKeyCheckedBeforeBody(s),
  cron: (s) => /CRON_SECRET/.test(s) && /constantTimeEqual\(/.test(s),
  authFlow: () => true,
  public: (s) => !/user_profiles|billing_|customer_/.test(s),
  notAllowed: (s) => /status: 405/.test(s),
  delegates: (s) => /from '\.\.\/\[id\]\/status'|return PUT\(context\)/.test(s),
  devOnly: (s) => /import\.meta\.env\.DEV/.test(s) && /withAuth\(/.test(s),
};

const API_ROOT = path.resolve(__dirname, "..");
const METHOD_EXPORT =
  /export\s+(?:const|async\s+function|function)\s+(GET|POST|PUT|PATCH|DELETE|ALL)\b([^\n]*)/g;

function apiFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory())
      return entry.name.startsWith("_") ? [] : apiFiles(full);
    return /\.(ts|js)$/.test(entry.name) && !entry.name.includes(".test.")
      ? [full]
      : [];
  });
}

function routeKey(file: string): string {
  return `/api/${path.relative(API_ROOT, file).split(path.sep).join("/")}`;
}

const handlers = apiFiles(API_ROOT).flatMap((file) => {
  const source = readFileSync(file, "utf-8");
  return [...source.matchAll(METHOD_EXPORT)].map((match) => ({
    route: routeKey(file),
    method: match[1] as string,
    exportLine: match[2] ?? "",
    source,
  }));
});

describe("API guard sweep", () => {
  it("finds the API handlers", () => {
    expect(handlers.length).toBeGreaterThan(100);
  });

  it.each(handlers.map((h) => [`${h.method} ${h.route}`, h] as const))(
    "%s is guarded",
    (_label, handler) => {
      if (/\b(withAuth|requireRole)\b/.test(handler.exportLine)) return;

      const exemption = EXEMPT[handler.route]?.[handler.method];
      expect(
        exemption,
        `${handler.method} ${handler.route} has no withAuth and no documented exemption`,
      ).toBeDefined();
      expect(
        EVIDENCE[exemption as Exemption](handler.source),
        `${exemption} evidence missing`,
      ).toBe(true);
    },
  );

  it("lists no exemption for a handler that no longer exists", () => {
    const present = new Set(handlers.map((h) => `${h.method} ${h.route}`));
    const stale = Object.entries(EXEMPT).flatMap(([route, methods]) =>
      Object.keys(methods)
        .filter((method) => !present.has(`${method} ${route}`))
        .map((m) => `${m} ${route}`),
    );
    expect(stale).toEqual([]);
  });
});
