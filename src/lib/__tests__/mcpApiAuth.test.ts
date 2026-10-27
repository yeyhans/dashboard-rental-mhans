import { afterEach, describe, expect, it, vi } from "vitest";
import { validateMcpApiKey } from "../serverApiAuth";

function requestWith(key: string | null): Request {
  const headers: Record<string, string> = {};
  if (key !== null) headers["X-API-Key"] = key;
  return new Request(
    "https://dashboard.mariohans.cl/api/external/inventory/units",
    { headers },
  );
}

describe("validateMcpApiKey", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts the dedicated MCP secret", () => {
    vi.stubEnv("MCP_API_SECRET", "mcp-secret");
    expect(validateMcpApiKey(requestWith("mcp-secret"))).toBe(true);
  });

  it("rejects a wrong or missing key", () => {
    vi.stubEnv("MCP_API_SECRET", "mcp-secret");
    expect(validateMcpApiKey(requestWith("other"))).toBe(false);
    expect(validateMcpApiKey(requestWith(null))).toBe(false);
  });

  it("never falls back to FRONTEND_API_SECRET or HERMES_API_SECRET", () => {
    vi.stubEnv("MCP_API_SECRET", "");
    vi.stubEnv("FRONTEND_API_SECRET", "frontend-secret");
    vi.stubEnv("HERMES_API_SECRET", "hermes-secret");
    expect(validateMcpApiKey(requestWith("frontend-secret"))).toBe(false);
    expect(validateMcpApiKey(requestWith("hermes-secret"))).toBe(false);
    expect(validateMcpApiKey(requestWith(""))).toBe(false);
  });

  it("rejects the frontend secret even when MCP_API_SECRET is configured", () => {
    vi.stubEnv("MCP_API_SECRET", "mcp-secret");
    vi.stubEnv("FRONTEND_API_SECRET", "frontend-secret");
    expect(validateMcpApiKey(requestWith("frontend-secret"))).toBe(false);
  });
});
