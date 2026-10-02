import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "../../../../../lib/siteSettings";

/**
 * `/api/admin/site-settings` and `/api/admin/site-settings/signature`. The service and the
 * worker (`fetch`) are mocked; `requireRole` is stubbed with the real shape (401 without a
 * session, 403 outside the allowed roles) so the gating assertions are about WHICH role the
 * routes ask for.
 */
const get = vi.fn();
const update = vi.fn();
const setSignatureUrl = vi.fn();

class MockValidationError extends Error {
  details: any;
  constructor(details: any) {
    super(details.message);
    this.details = details;
  }
}

vi.mock("../../../../../middleware/auth", () => ({
  requireRole:
    (...roles: string[]) =>
    (handler: (context: any) => Promise<Response>) =>
    async (context: any) => {
      const user = context.user ?? context.locals?.user;
      if (!user) {
        return new Response(
          JSON.stringify({ success: false, error: "No autorizado" }),
          { status: 401 },
        );
      }
      if (!roles.includes(user.role)) {
        return new Response(
          JSON.stringify({ success: false, error: "Permisos insuficientes" }),
          { status: 403 },
        );
      }
      return handler(context);
    },
}));

vi.mock("../../../../../services/siteSettingsService", () => ({
  SiteSettingsService: { get, update, setSignatureUrl },
  SiteSettingsValidationError: MockValidationError,
}));

const superAdmin = {
  user: { id: "sa", email: "sa@x.cl", role: "super_admin" },
};
const admin = { user: { id: "a", email: "a@x.cl", role: "admin" } };

function jsonRequest(method: string, body?: unknown) {
  return new Request("https://dashboard.mariohans.cl/api/admin/site-settings", {
    method: method === "GET" ? "GET" : method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined
      ? { body: typeof body === "string" ? body : JSON.stringify(body) }
      : {}),
  });
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("GET /api/admin/site-settings", () => {
  it("requires authentication and the super_admin role", async () => {
    const { GET } = await import("../index");
    const anon = await GET({ request: jsonRequest("GET") } as any);
    expect(anon.status).toBe(401);
    const forbidden = await GET({
      request: jsonRequest("GET"),
      ...admin,
    } as any);
    expect(forbidden.status).toBe(403);
    expect(get).not.toHaveBeenCalled();
  });

  it("returns the settings in the envelope", async () => {
    get.mockResolvedValue(DEFAULT_SETTINGS);
    const { GET } = await import("../index");
    const res = await GET({
      request: jsonRequest("GET"),
      ...superAdmin,
    } as any);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: DEFAULT_SETTINGS });
  });

  it("answers 500 with a generic Spanish message when the service throws", async () => {
    get.mockRejectedValue(new Error("db down"));
    const { GET } = await import("../index");
    const res = await GET({
      request: jsonRequest("GET"),
      ...superAdmin,
    } as any);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).not.toContain("db down");
  });
});

describe("PUT /api/admin/site-settings", () => {
  it("is forbidden for a plain admin", async () => {
    const { PUT } = await import("../index");
    const res = await PUT({ request: jsonRequest("PUT", {}), ...admin } as any);
    expect(res.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON and non-object bodies with 400", async () => {
    const { PUT } = await import("../index");
    expect(
      (
        await PUT({
          request: jsonRequest("PUT", "{nope"),
          ...superAdmin,
        } as any)
      ).status,
    ).toBe(400);
    expect(
      (await PUT({ request: jsonRequest("PUT", "[1]"), ...superAdmin } as any))
        .status,
    ).toBe(400);
  });

  it("saves and returns the settings, recording who saved them", async () => {
    update.mockResolvedValue(DEFAULT_SETTINGS);
    const { PUT } = await import("../index");
    const res = await PUT({
      request: jsonRequest("PUT", { reserve: { defaultPct: 30 } }),
      ...superAdmin,
    } as any);
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      { reserve: { defaultPct: 30 } },
      "sa@x.cl",
    );
    expect((await res.json()).data).toEqual(DEFAULT_SETTINGS);
  });

  it("answers 400 with the flattened Spanish issues when validation fails", async () => {
    update.mockRejectedValue(
      new MockValidationError({
        message: "Hay datos inválidos en la configuración",
        issues: [
          { path: "contact.email", message: "Correo electrónico inválido" },
        ],
      }),
    );
    const { PUT } = await import("../index");
    const res = await PUT({
      request: jsonRequest("PUT", { contact: { email: "x" } }),
      ...superAdmin,
    } as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("contact.email: Correo electrónico inválido");
    expect(body.details).toEqual([
      { path: "contact.email", message: "Correo electrónico inválido" },
    ]);
  });

  it("answers 500 when the service fails for another reason", async () => {
    update.mockRejectedValue(new Error("boom"));
    const { PUT } = await import("../index");
    const res = await PUT({
      request: jsonRequest("PUT", {}),
      ...superAdmin,
    } as any);
    expect(res.status).toBe(500);
    expect((await res.json()).error).not.toContain("boom");
  });
});

describe("POST /api/admin/site-settings/signature", () => {
  const PNG = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
  ]);
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

  function uploadRequest(
    bytes: Uint8Array | null,
    name = "firma.png",
    type = "image/png",
  ) {
    const form = new FormData();
    if (bytes) form.append("file", new File([bytes], name, { type }));
    return new Request(
      "https://dashboard.mariohans.cl/api/admin/site-settings/signature",
      {
        method: "POST",
        body: form,
      },
    );
  }

  it("is forbidden for a plain admin", async () => {
    const { POST } = await import("../signature");
    const res = await POST({ request: uploadRequest(PNG), ...admin } as any);
    expect(res.status).toBe(403);
  });

  it("rejects a missing file", async () => {
    const { POST } = await import("../signature");
    const res = await POST({
      request: uploadRequest(null),
      ...superAdmin,
    } as any);
    expect(res.status).toBe(400);
  });

  it("rejects a file whose bytes are not PNG or JPEG even if the name says png", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("../signature");
    const res = await POST({
      request: uploadRequest(
        new TextEncoder().encode("hello world"),
        "firma.png",
        "image/png",
      ),
      ...superAdmin,
    } as any);
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a file larger than 1 MB", async () => {
    const big = new Uint8Array(1024 * 1024 + 1);
    big.set(PNG);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("../signature");
    const res = await POST({
      request: uploadRequest(big),
      ...superAdmin,
    } as any);
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards a PNG to the worker and stores the cache-busted url", async () => {
    vi.stubEnv("PUBLIC_CLOUDFLARE_WORKER_URL", "https://worker.test");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            url: "https://media.test/firmas/f.png",
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    setSignatureUrl.mockResolvedValue({
      ...DEFAULT_SETTINGS,
      representative: {
        ...DEFAULT_SETTINGS.representative,
        signatureUrl: "https://media.test/firmas/f.png?v=1",
      },
    });

    const { POST } = await import("../signature");
    const res = await POST({
      request: uploadRequest(PNG),
      ...superAdmin,
    } as any);

    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://worker.test/upload-file-only");
    const sent = init.body as FormData;
    expect(sent.get("documentType")).toBe("firma_representante");
    expect(sent.get("userId")).toBe("site");
    expect(sent.get("file")).toBeInstanceOf(Blob);

    const stored = setSignatureUrl.mock.calls[0];
    expect(stored[0]).toMatch(/^https:\/\/media\.test\/firmas\/f\.png\?v=\d+$/);
    expect(stored[1]).toBe("sa@x.cl");
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.signatureUrl).toMatch(/\?v=\d+$/);
  });

  it("accepts a JPEG", async () => {
    vi.stubEnv("PUBLIC_CLOUDFLARE_WORKER_URL", "https://worker.test");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ success: true, url: "https://m.test/f.jpg" }),
          ),
        ),
    );
    setSignatureUrl.mockResolvedValue(DEFAULT_SETTINGS);
    const { POST } = await import("../signature");
    const res = await POST({
      request: uploadRequest(JPEG, "f.jpg", "image/jpeg"),
      ...superAdmin,
    } as any);
    expect(res.status).toBe(200);
  });

  it("answers 502 when the worker fails and does not store anything", async () => {
    vi.stubEnv("PUBLIC_CLOUDFLARE_WORKER_URL", "https://worker.test");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response('{"success":false}', { status: 500 })),
    );
    const { POST } = await import("../signature");
    const res = await POST({
      request: uploadRequest(PNG),
      ...superAdmin,
    } as any);
    expect(res.status).toBe(502);
    expect(setSignatureUrl).not.toHaveBeenCalled();
  });

  it("answers 502 when the worker answers success without a url", async () => {
    vi.stubEnv("PUBLIC_CLOUDFLARE_WORKER_URL", "https://worker.test");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response('{"success":true}', { status: 200 })),
    );
    const { POST } = await import("../signature");
    const res = await POST({
      request: uploadRequest(PNG),
      ...superAdmin,
    } as any);
    expect(res.status).toBe(502);
    expect(setSignatureUrl).not.toHaveBeenCalled();
  });

  it("answers 502 when the worker is unreachable", async () => {
    vi.stubEnv("PUBLIC_CLOUDFLARE_WORKER_URL", "https://worker.test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const { POST } = await import("../signature");
    const res = await POST({
      request: uploadRequest(PNG),
      ...superAdmin,
    } as any);
    expect(res.status).toBe(502);
  });
});
