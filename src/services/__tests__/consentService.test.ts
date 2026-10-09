import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ConsentService: append-only consent ledger (`data_consents`). Thenable query-builder double,
 * same approach as `assetMovementFeed.test.ts`.
 */
const state = vi.hoisted(() => ({
  results: {} as Record<string, Array<{ data: unknown; error: unknown }>>,
  calls: [] as Array<{ table: string; op: string; args: unknown[] }>,
}));

function tableBuilder(table: string) {
  const builder: any = {
    then: (
      resolve: (value: unknown) => void,
      reject?: (reason: unknown) => void,
    ) => {
      const queue = state.results[table] ?? [];
      const next = queue.shift() ?? { data: null, error: null };
      return Promise.resolve(next).then(resolve, reject);
    },
  };
  for (const op of [
    "select",
    "insert",
    "eq",
    "order",
    "limit",
    "maybeSingle",
  ]) {
    builder[op] = (...args: unknown[]) => {
      state.calls.push({ table, op, args });
      return builder;
    };
  }
  return builder;
}

vi.mock("../../lib/supabase", () => ({
  supabaseAdmin: { from: (table: string) => tableBuilder(table) },
}));

const { ConsentService } = await import("../consentService");

const UID = "3f2b8c1e-5a4d-4c7e-9b1a-2d6e8f0a1b3c";

beforeEach(() => {
  state.calls = [];
  state.results = {};
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("ConsentService.isValidUuid", () => {
  it("accepts a UUID and rejects other strings", () => {
    expect(ConsentService.isValidUuid(UID)).toBe(true);
    expect(ConsentService.isValidUuid("not-a-uuid")).toBe(false);
    expect(ConsentService.isValidUuid("")).toBe(false);
  });
});

describe("ConsentService.normalizeIp", () => {
  it("keeps valid IPv4 and IPv6, trimmed", () => {
    expect(ConsentService.normalizeIp(" 200.1.2.3 ")).toBe("200.1.2.3");
    expect(ConsentService.normalizeIp("2001:db8::1")).toBe("2001:db8::1");
  });

  it("drops invalid or non-string values to null", () => {
    expect(ConsentService.normalizeIp("999.1.1.1")).toBeNull();
    expect(ConsentService.normalizeIp("hello")).toBeNull();
    expect(ConsentService.normalizeIp(undefined)).toBeNull();
    expect(ConsentService.normalizeIp(42)).toBeNull();
  });
});

describe("ConsentService.normalizeUserAgent", () => {
  it("truncates to 512 characters and nulls empty values", () => {
    expect(ConsentService.normalizeUserAgent("a".repeat(600))).toHaveLength(
      512,
    );
    expect(ConsentService.normalizeUserAgent("")).toBeNull();
    expect(ConsentService.normalizeUserAgent(undefined)).toBeNull();
  });
});

describe("ConsentService.userExists", () => {
  it("is true when a profile with that auth_uid exists", async () => {
    state.results.user_profiles = [{ data: { auth_uid: UID }, error: null }];
    await expect(ConsentService.userExists(UID)).resolves.toBe(true);
    expect(state.calls).toContainEqual({
      table: "user_profiles",
      op: "eq",
      args: ["auth_uid", UID],
    });
  });

  it("is false when none exists", async () => {
    state.results.user_profiles = [{ data: null, error: null }];
    await expect(ConsentService.userExists(UID)).resolves.toBe(false);
  });

  it("throws on a database error", async () => {
    state.results.user_profiles = [{ data: null, error: { message: "boom" } }];
    await expect(ConsentService.userExists(UID)).rejects.toBeDefined();
  });
});

describe("ConsentService.record", () => {
  it("inserts one row per consent in a single insert", async () => {
    state.results.data_consents = [{ data: null, error: null }];

    const recorded = await ConsentService.record({
      authUid: UID,
      consentVersion: "v1",
      consents: [
        { purpose: "international_transfer", granted: true },
        { purpose: "ocr_processing", granted: false },
      ],
      ipAddress: "200.1.2.3",
      userAgent: "UA",
    });

    expect(recorded).toBe(2);
    const inserts = state.calls.filter((c) => c.op === "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0]!.args[0]).toEqual([
      {
        auth_uid: UID,
        purpose: "international_transfer",
        consent_version: "v1",
        granted: true,
        ip_address: "200.1.2.3",
        user_agent: "UA",
      },
      {
        auth_uid: UID,
        purpose: "ocr_processing",
        consent_version: "v1",
        granted: false,
        ip_address: "200.1.2.3",
        user_agent: "UA",
      },
    ]);
  });

  it("throws when the insert fails", async () => {
    state.results.data_consents = [{ data: null, error: { message: "boom" } }];
    await expect(
      ConsentService.record({
        authUid: UID,
        consentVersion: "v1",
        consents: [{ purpose: "ocr_processing", granted: true }],
        ipAddress: null,
        userAgent: null,
      }),
    ).rejects.toBeDefined();
  });
});

describe("ConsentService.getStatus", () => {
  it("returns null for purposes with no rows", async () => {
    state.results.data_consents = [{ data: [], error: null }];
    await expect(ConsentService.getStatus(UID)).resolves.toEqual({
      international_transfer: null,
      ocr_processing: null,
    });
  });

  it("uses the latest row per purpose (latest wins)", async () => {
    // Rows arrive newest first.
    state.results.data_consents = [
      {
        data: [
          {
            purpose: "international_transfer",
            granted: false,
            consent_version: "v2",
            created_at: "2026-10-08T10:00:00Z",
          },
          {
            purpose: "ocr_processing",
            granted: true,
            consent_version: "v1",
            created_at: "2026-10-07T10:00:00Z",
          },
          {
            purpose: "international_transfer",
            granted: true,
            consent_version: "v1",
            created_at: "2026-10-01T10:00:00Z",
          },
        ],
        error: null,
      },
    ];

    await expect(ConsentService.getStatus(UID)).resolves.toEqual({
      international_transfer: {
        granted: false,
        consent_version: "v2",
        created_at: "2026-10-08T10:00:00Z",
      },
      ocr_processing: {
        granted: true,
        consent_version: "v1",
        created_at: "2026-10-07T10:00:00Z",
      },
    });
    expect(state.calls).toContainEqual({
      table: "data_consents",
      op: "order",
      args: ["created_at", { ascending: false }],
    });
  });

  it("throws on a database error", async () => {
    state.results.data_consents = [{ data: null, error: { message: "boom" } }];
    await expect(ConsentService.getStatus(UID)).rejects.toBeDefined();
  });
});
