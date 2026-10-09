import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const userExists = vi.fn();
const record = vi.fn();
const getStatus = vi.fn();

vi.mock("../../../../services/consentService", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../services/consentService")
  >("../../../../services/consentService");
  return {
    ...actual,
    ConsentService: Object.assign(Object.create(actual.ConsentService), {
      userExists,
      record,
      getStatus,
    }),
  };
});

vi.mock("../../../../lib/supabase", () => ({ supabaseAdmin: {} }));

const UID = "3f2b8c1e-5a4d-4c7e-9b1a-2d6e8f0a1b3c";

/** Each test uses a distinct client IP: the rate limiter is module-level in-memory state. */
let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.1.0.${ipCounter}`;
}

function buildRequest(
  apiKey: string | null,
  body: unknown,
  rawBody?: string,
): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-forwarded-for": nextIp(),
  };
  if (apiKey !== null) headers["X-API-Key"] = apiKey;
  return new Request("https://dashboard.mariohans.cl/api/external/consents/x", {
    method: "POST",
    headers,
    body: rawBody ?? JSON.stringify(body),
  });
}

const validRecordBody = {
  auth_uid: UID,
  consent_version: "v1",
  consents: [
    { purpose: "international_transfer", granted: true },
    { purpose: "ocr_processing", granted: false },
  ],
  ip_address: "200.1.2.3",
  user_agent: "Mozilla/5.0",
};

beforeEach(() => {
  vi.stubEnv("FRONTEND_API_SECRET", "frontend-secret");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/external/consents/record", () => {
  it("returns 401 without a valid X-API-Key", async () => {
    const { POST } = await import("../consents/record");

    const missing = await POST({
      request: buildRequest(null, validRecordBody),
    } as never);
    const wrong = await POST({
      request: buildRequest("nope", validRecordBody),
    } as never);

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(record).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid JSON", async () => {
    const { POST } = await import("../consents/record");
    const res = await POST({
      request: buildRequest("frontend-secret", null, "{oops"),
    } as never);
    expect(res.status).toBe(400);
  });

  it.each([
    ["auth_uid is not a UUID", { ...validRecordBody, auth_uid: "abc" }],
    ["consent_version is empty", { ...validRecordBody, consent_version: "  " }],
    [
      "consent_version is too long",
      { ...validRecordBody, consent_version: "v".repeat(65) },
    ],
    ["consents is empty", { ...validRecordBody, consents: [] }],
    [
      "purpose is not allowed",
      {
        ...validRecordBody,
        consents: [{ purpose: "marketing", granted: true }],
      },
    ],
    [
      "granted is not boolean",
      {
        ...validRecordBody,
        consents: [{ purpose: "ocr_processing", granted: "yes" }],
      },
    ],
  ])("returns 400 when %s", async (_name, body) => {
    const { POST } = await import("../consents/record");
    const res = await POST({
      request: buildRequest("frontend-secret", body),
    } as never);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(typeof payload.error).toBe("string");
    expect(userExists).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it("returns 404 when the auth_uid has no profile", async () => {
    userExists.mockResolvedValue(false);
    const { POST } = await import("../consents/record");

    const res = await POST({
      request: buildRequest("frontend-secret", validRecordBody),
    } as never);
    const payload = await res.json();

    expect(res.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(record).not.toHaveBeenCalled();
  });

  it("records consents and returns 201 with the count", async () => {
    userExists.mockResolvedValue(true);
    record.mockResolvedValue(2);
    const { POST } = await import("../consents/record");

    const res = await POST({
      request: buildRequest("frontend-secret", validRecordBody),
    } as never);
    const payload = await res.json();

    expect(res.status).toBe(201);
    expect(payload).toEqual({ success: true, data: { recorded: 2 } });
    expect(record).toHaveBeenCalledWith({
      authUid: UID,
      consentVersion: "v1",
      consents: validRecordBody.consents,
      ipAddress: "200.1.2.3",
      userAgent: "Mozilla/5.0",
    });
  });

  it("records a withdrawal (granted=false) as a new row", async () => {
    userExists.mockResolvedValue(true);
    record.mockResolvedValue(1);
    const { POST } = await import("../consents/record");

    const res = await POST({
      request: buildRequest("frontend-secret", {
        ...validRecordBody,
        consents: [{ purpose: "international_transfer", granted: false }],
      }),
    } as never);

    expect(res.status).toBe(201);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        consents: [{ purpose: "international_transfer", granted: false }],
      }),
    );
  });

  it("drops an invalid ip_address instead of failing, and truncates user_agent", async () => {
    userExists.mockResolvedValue(true);
    record.mockResolvedValue(2);
    const { POST } = await import("../consents/record");

    const res = await POST({
      request: buildRequest("frontend-secret", {
        ...validRecordBody,
        ip_address: "not-an-ip",
        user_agent: "u".repeat(900),
      }),
    } as never);

    expect(res.status).toBe(201);
    const arg = record.mock.calls[0]![0];
    expect(arg.ipAddress).toBeNull();
    expect(arg.userAgent).toHaveLength(512);
  });

  it("returns 500 with a generic message when the service throws, without leaking IP or UA", async () => {
    userExists.mockResolvedValue(true);
    record.mockRejectedValue(new Error("db exploded"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("../consents/record");

    const res = await POST({
      request: buildRequest("frontend-secret", validRecordBody),
    } as never);
    const payload = await res.json();

    expect(res.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(JSON.stringify(payload)).not.toContain("db exploded");
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toContain("200.1.2.3");
    expect(logged).not.toContain("Mozilla");
    expect(logged).not.toContain("frontend-secret");
  });
});

describe("POST /api/external/consents/status", () => {
  it("returns 401 without a valid X-API-Key", async () => {
    const { POST } = await import("../consents/status");
    const res = await POST({
      request: buildRequest("nope", { auth_uid: UID }),
    } as never);
    expect(res.status).toBe(401);
    expect(getStatus).not.toHaveBeenCalled();
  });

  it("returns 400 when auth_uid is not a UUID", async () => {
    const { POST } = await import("../consents/status");
    const res = await POST({
      request: buildRequest("frontend-secret", { auth_uid: "abc" }),
    } as never);
    expect(res.status).toBe(400);
    expect(getStatus).not.toHaveBeenCalled();
  });

  it("returns 404 when the auth_uid has no profile", async () => {
    userExists.mockResolvedValue(false);
    const { POST } = await import("../consents/status");
    const res = await POST({
      request: buildRequest("frontend-secret", { auth_uid: UID }),
    } as never);
    expect(res.status).toBe(404);
    expect(getStatus).not.toHaveBeenCalled();
  });

  it("returns the current state per purpose with 200", async () => {
    userExists.mockResolvedValue(true);
    const status = {
      international_transfer: {
        granted: false,
        consent_version: "v2",
        created_at: "2026-10-08T10:00:00Z",
      },
      ocr_processing: null,
    };
    getStatus.mockResolvedValue(status);
    const { POST } = await import("../consents/status");

    const res = await POST({
      request: buildRequest("frontend-secret", { auth_uid: UID }),
    } as never);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload).toEqual({ success: true, data: status });
    expect(getStatus).toHaveBeenCalledWith(UID);
  });

  it("returns 500 with a generic message when the service throws", async () => {
    userExists.mockResolvedValue(true);
    getStatus.mockRejectedValue(new Error("db exploded"));
    const { POST } = await import("../consents/status");

    const res = await POST({
      request: buildRequest("frontend-secret", { auth_uid: UID }),
    } as never);
    const payload = await res.json();

    expect(res.status).toBe(500);
    expect(JSON.stringify(payload)).not.toContain("db exploded");
  });
});
