import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getPublicProfile = vi.fn();

vi.mock("../../../../services/siteSettingsService", () => ({
  SiteSettingsService: { getPublicProfile },
}));
vi.mock("../../../../lib/supabase", () => ({ supabaseAdmin: {} }));

const PROFILE = {
  legalName: "ACME SpA",
  tradeName: "Acme",
  rut: "76.000.000-0",
  representativeName: "Ana Perez",
  contactEmail: "privacidad@acme.cl",
  phone: "+56911112222",
  domicilio: "Calle 1",
};

/** Each test uses a distinct client IP: the rate limiter is module-level in-memory state. */
let ipCounter = 0;
function buildRequest(apiKey: string | null, ip?: string): Request {
  ipCounter += 1;
  const headers: Record<string, string> = {
    "x-forwarded-for": ip ?? `10.2.0.${ipCounter}`,
  };
  if (apiKey !== null) headers["X-API-Key"] = apiKey;
  return new Request(
    "https://dashboard.mariohans.cl/api/external/site-settings",
    {
      method: "GET",
      headers,
    },
  );
}

beforeEach(() => {
  vi.stubEnv("FRONTEND_API_SECRET", "frontend-secret");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/external/site-settings", () => {
  it("returns 401 without a valid X-API-Key", async () => {
    const { GET } = await import("../site-settings");
    const missing = await GET({ request: buildRequest(null) } as never);
    const wrong = await GET({ request: buildRequest("nope") } as never);
    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(getPublicProfile).not.toHaveBeenCalled();
  });

  it("returns the public profile with a private cache header", async () => {
    getPublicProfile.mockResolvedValue(PROFILE);
    const { GET } = await import("../site-settings");
    const res = await GET({
      request: buildRequest("frontend-secret"),
    } as never);

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=60");
    expect(await res.json()).toEqual({ success: true, data: PROFILE });
  });

  it("returns 500 with a generic error when the service throws", async () => {
    getPublicProfile.mockRejectedValue(new Error("db down"));
    const { GET } = await import("../site-settings");
    const res = await GET({
      request: buildRequest("frontend-secret"),
    } as never);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(JSON.stringify(body)).not.toContain("db down");
    expect(console.error).toHaveBeenCalled();
  });

  it("returns 429 after exceeding the rate limit", async () => {
    getPublicProfile.mockResolvedValue(PROFILE);
    const { GET } = await import("../site-settings");
    const ip = "10.9.9.9";
    let last: Response | undefined;
    for (let i = 0; i < 121; i++) {
      last = await GET({
        request: buildRequest("frontend-secret", ip),
      } as never);
    }
    expect(last?.status).toBe(429);
  });
});
