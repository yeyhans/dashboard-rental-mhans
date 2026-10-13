import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * D1-c: attachment URLs on a manual email are admin-supplied, so the server only downloads them
 * over https from the app's own hosts, never following a redirect, and with a hard byte cap.
 */
const sendEmailViaWorker = vi.hoisted(() =>
  vi.fn(async (..._args: unknown[]) => ({ success: true, emailId: "e-1" })),
);

vi.mock("../../../../middleware/auth", () => ({
  withAuth: (handler: (context: any) => Promise<Response>) => handler,
}));

vi.mock("../../../../lib/rateLimit", () => ({
  checkRateLimit: () => ({ allowed: true }),
  getClientIp: () => "127.0.0.1",
  rateLimitResponse: () => new Response(null, { status: 429 }),
  RATE_LIMITS: { email: {} },
}));

vi.mock("../../../../lib/emailWorkerService", () => ({
  sendEmailViaWorker,
}));

const { POST } = await import("../send-manual-email");

function post(attachmentUrl: string) {
  return POST({
    request: new Request(
      "https://dashboard.mariohans.cl/api/emails/send-manual-email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "cliente@example.com",
          subject: "Documentos",
          html: "<p>Hola</p>",
          metadata: {
            order_id: 7,
            attachments: [{ url: attachmentUrl, filename: "doc.pdf" }],
          },
        }),
      },
    ),
    locals: { user: { id: "admin-1", role: "admin" } },
  } as never);
}

function sentAttachments(): unknown {
  return sendEmailViaWorker.mock.calls[0]?.[3];
}

describe("send-manual-email attachment URLs (D1-c)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    sendEmailViaWorker.mockClear();
  });

  it("never downloads from a host outside the allowlist", async () => {
    const fetchSpy = vi.fn(async () => new Response("pdf"));
    vi.stubGlobal("fetch", fetchSpy);

    const response = await post("https://169.254.169.254/latest/meta-data");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(sentAttachments()).toBeUndefined();
  });

  it("refuses to follow a redirect", async () => {
    const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.redirect !== "error") {
        return new Response("internal", { status: 200 });
      }
      throw new TypeError("fetch failed: redirect mode is set to error");
    });
    vi.stubGlobal("fetch", fetchSpy);

    await post("https://media.mariohans.cl/doc.pdf");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]![1]).toMatchObject({ redirect: "error" });
    expect(sentAttachments()).toBeUndefined();
  });

  it("drops an attachment over the byte cap", async () => {
    const big = new Uint8Array(6 * 1024 * 1024);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(big, { status: 200 })),
    );

    await post("https://media.mariohans.cl/doc.pdf");

    expect(sentAttachments()).toBeUndefined();
  });

  it("attaches an allowed, small file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("%PDF-1.4", { status: 200 })),
    );

    await post("https://media.mariohans.cl/doc.pdf");

    expect(sentAttachments()).toEqual([
      {
        filename: "doc.pdf",
        content: Buffer.from("%PDF-1.4").toString("base64"),
        contentType: "application/pdf",
      },
    ]);
  });
});
