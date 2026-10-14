import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * B-2 sweep (audit 2026-10-14): `isFrontendApiKeyOrAdmin` accepted ANY admin session, including
 * an `operator`. Operators are confined to the garage scan endpoints by `resolveAccess` inside
 * `withAuth`, but the routes guarded by this helper (create order, send budget/order e-mails,
 * generate budget/contract PDFs) never went through `withAuth`, so an operator could reach them.
 */
const getServerAdmin = vi.fn();

vi.mock("../supabase", () => ({
  getServerAdmin: (...args: unknown[]) => getServerAdmin(...args),
}));

const { isFrontendApiKeyOrAdmin } = await import("../serverApiAuth");

function sessionFor(role: string) {
  return {
    user: { id: "auth-uid", email: "x@test.cl" },
    admin: {
      id: 1,
      user_id: "auth-uid",
      email: "x@test.cl",
      role,
      is_active: true,
      created_at: "",
    },
  };
}

function ctx(headers: Record<string, string> = {}) {
  return {
    request: new Request("https://dash.test/api/orders", {
      method: "POST",
      headers,
    }),
  };
}

describe("isFrontendApiKeyOrAdmin — role gating", () => {
  beforeEach(() => {
    getServerAdmin.mockReset();
    vi.stubEnv("FRONTEND_API_SECRET", "frontend-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts the frontend API key without looking at the session", async () => {
    await expect(
      isFrontendApiKeyOrAdmin(ctx({ "X-API-Key": "frontend-secret" })),
    ).resolves.toBe(true);
    expect(getServerAdmin).not.toHaveBeenCalled();
  });

  it.each(["admin", "super_admin"])("accepts a %s session", async (role) => {
    getServerAdmin.mockResolvedValue(sessionFor(role));
    await expect(isFrontendApiKeyOrAdmin(ctx())).resolves.toBe(true);
  });

  it("rejects an operator session", async () => {
    getServerAdmin.mockResolvedValue(sessionFor("operator"));
    await expect(isFrontendApiKeyOrAdmin(ctx())).resolves.toBe(false);
  });

  it("rejects a request with neither key nor session", async () => {
    getServerAdmin.mockResolvedValue(null);
    await expect(isFrontendApiKeyOrAdmin(ctx())).resolves.toBe(false);
  });
});
