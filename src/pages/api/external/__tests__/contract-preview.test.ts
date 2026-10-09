import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../../../lib/siteSettings";

const get = vi.fn();

vi.mock("../../../../services/siteSettingsService", () => ({
  SiteSettingsService: { get },
}));
vi.mock("../../../../lib/supabase", () => ({ supabaseAdmin: {} }));

const BODY = {
  tipo_cliente: "natural",
  nombre: "Ana",
  apellido: "Pérez",
  rut: "12.345.678-5",
  direccion: "Calle 1 #23",
};

/** Each test uses a distinct client IP: the rate limiter is module-level in-memory state. */
let ipCounter = 0;
function buildRequest(apiKey: string | null, body: unknown = BODY): Request {
  ipCounter += 1;
  const headers: Record<string, string> = {
    "x-forwarded-for": `10.3.0.${ipCounter}`,
    "Content-Type": "application/json",
  };
  if (apiKey !== null) headers["X-API-Key"] = apiKey;
  return new Request(
    "https://dashboard.mariohans.cl/api/external/contract-preview",
    {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
  );
}

async function call(request: Request): Promise<Response> {
  const { POST } = await import("../contract-preview");
  return POST({ request } as never) as Promise<Response>;
}

beforeEach(() => {
  vi.stubEnv("FRONTEND_API_SECRET", "frontend-secret");
  vi.spyOn(console, "error").mockImplementation(() => {});
  get.mockResolvedValue(DEFAULT_SETTINGS);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/external/contract-preview", () => {
  it("returns 401 without a valid X-API-Key", async () => {
    expect((await call(buildRequest(null))).status).toBe(401);
    expect((await call(buildRequest("wrong"))).status).toBe(401);
    expect(get).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON and invalid fields", async () => {
    expect((await call(buildRequest("frontend-secret", "{nope"))).status).toBe(
      400,
    );
    const res = await call(
      buildRequest("frontend-secret", { ...BODY, rut: "1-9" }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).success).toBe(false);
  });

  it("returns the structured contract with no-store caching", async () => {
    const res = await call(buildRequest("frontend-secret"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.parties[0]).toContain("Ana Pérez");
    expect(json.data.clauses.length).toBeGreaterThan(5);
    expect(json.data.issuedOn).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it("returns a generic 500 and does not log the body", async () => {
    get.mockRejectedValueOnce(new Error("db down"));
    const res = await call(buildRequest("frontend-secret"));
    expect(res.status).toBe(500);
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).not.toContain("12.345.678-5");
    expect(logged).not.toContain("Ana");
  });
});
