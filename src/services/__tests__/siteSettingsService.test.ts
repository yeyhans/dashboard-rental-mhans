import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "../../lib/siteSettings";
import {
  SiteSettingsService,
  SiteSettingsValidationError,
  __resetCacheForTests,
} from "../siteSettingsService";

/**
 * `SiteSettingsService` against `site_settings` (0015). `supabaseAdmin` is replaced by a recorder,
 * same boundary mock as `operatorService.test.ts`.
 */
const state = vi.hoisted(() => ({
  read: { data: null as any, error: null as any },
  upsert: { error: null as any },
  calls: [] as Array<{ op: string; args?: unknown }>,
}));

vi.mock("../../lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "site_settings")
        throw new Error(`unexpected table: ${table}`);
      const builder: any = {
        select: (cols: string) => {
          state.calls.push({ op: "select", args: cols });
          return builder;
        },
        eq: (col: string, val: unknown) => {
          state.calls.push({ op: "eq", args: [col, val] });
          return builder;
        },
        maybeSingle: async () => {
          state.calls.push({ op: "maybeSingle" });
          return state.read;
        },
        upsert: async (row: unknown) => {
          state.calls.push({ op: "upsert", args: row });
          return state.upsert;
        },
      };
      return builder;
    },
  },
}));

beforeEach(() => {
  state.read = { data: null, error: null };
  state.upsert = { error: null };
  state.calls = [];
  __resetCacheForTests();
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("SiteSettingsService.get", () => {
  it("returns the defaults when there is no row", async () => {
    const settings = await SiteSettingsService.get();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it("merges the stored data over the defaults", async () => {
    state.read = {
      data: { data: { bank: { accountNumber: "999" } } },
      error: null,
    };
    const settings = await SiteSettingsService.get();
    expect(settings.bank.accountNumber).toBe("999");
    expect(settings.bank.holder).toBe(DEFAULT_SETTINGS.bank.holder);
  });

  it("caches for 60 seconds and re-reads afterwards", async () => {
    vi.useFakeTimers();
    try {
      await SiteSettingsService.get();
      await SiteSettingsService.get();
      expect(state.calls.filter((c) => c.op === "maybeSingle")).toHaveLength(1);

      vi.advanceTimersByTime(61_000);
      await SiteSettingsService.get();
      expect(state.calls.filter((c) => c.op === "maybeSingle")).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to the defaults and logs once when the table is missing", async () => {
    state.read = {
      data: null,
      error: { code: "42P01", message: "relation does not exist" },
    };
    expect(await SiteSettingsService.get()).toEqual(DEFAULT_SETTINGS);

    __resetCacheForTests({ keepWarned: true });
    expect(await SiteSettingsService.get()).toEqual(DEFAULT_SETTINGS);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("falls back to the defaults when the stored data is invalid", async () => {
    state.read = { data: { data: { contact: { email: "bad" } } }, error: null };
    expect(await SiteSettingsService.get()).toEqual(DEFAULT_SETTINGS);
    expect(console.error).toHaveBeenCalled();
  });
});

describe("SiteSettingsService.update", () => {
  it("validates, upserts row id 1 and returns the saved settings", async () => {
    state.read = {
      data: { data: { bank: { accountNumber: "111" } } },
      error: null,
    };

    const saved = await SiteSettingsService.update(
      { reserve: { defaultPct: 30 } },
      "admin@x.cl",
    );

    expect(saved.reserve.defaultPct).toBe(30);
    expect(saved.bank.accountNumber).toBe("111");
    const upsert = state.calls.find((c) => c.op === "upsert")!.args as any;
    expect(upsert.id).toBe(1);
    expect(upsert.updated_by).toBe("admin@x.cl");
    expect(upsert.data.reserve.defaultPct).toBe(30);
  });

  it("throws a validation error with the issues and does not write", async () => {
    await expect(
      SiteSettingsService.update(
        { contact: { email: "nope" } } as any,
        "admin@x.cl",
      ),
    ).rejects.toBeInstanceOf(SiteSettingsValidationError);
    expect(state.calls.some((c) => c.op === "upsert")).toBe(false);
  });

  it("invalidates the cache after a write", async () => {
    await SiteSettingsService.get();
    await SiteSettingsService.update({ reserve: { defaultPct: 40 } }, "a@x.cl");
    state.read = {
      data: { data: { reserve: { defaultPct: 40 } } },
      error: null,
    };

    const settings = await SiteSettingsService.get();
    expect(settings.reserve.defaultPct).toBe(40);
  });

  it("propagates a database error", async () => {
    state.upsert = { error: { message: "boom" } };
    await expect(
      SiteSettingsService.update({ reserve: { defaultPct: 40 } }, "a@x.cl"),
    ).rejects.toEqual({
      message: "boom",
    });
  });
});

describe("SiteSettingsService.update fails closed on a degraded read", () => {
  // R4-001: the write path must never seed its merge from the defaults fallback, or a transient
  // read error would overwrite every saved value with DEFAULT_SETTINGS + patch.
  it("rejects and does not upsert when the row cannot be read", async () => {
    state.read = {
      data: null,
      error: { code: "57P01", message: "terminating" },
    };
    await expect(
      SiteSettingsService.update({ reserve: { defaultPct: 30 } }, "admin@x.cl"),
    ).rejects.toThrow();
    expect(state.calls.some((c) => c.op === "upsert")).toBe(false);
  });

  it("rejects and does not upsert when the stored data fails validation", async () => {
    state.read = { data: { data: { contact: { email: "bad" } } }, error: null };
    await expect(
      SiteSettingsService.setSignatureUrl(
        "https://media.mariohans.cl/x.png",
        "admin@x.cl",
      ),
    ).rejects.toThrow();
    expect(state.calls.some((c) => c.op === "upsert")).toBe(false);
  });
});

describe("SiteSettingsService.setSignatureUrl", () => {
  it("stores the url and a timestamp in the representative section", async () => {
    const saved = await SiteSettingsService.setSignatureUrl(
      "https://media.mariohans.cl/f.png?v=1",
      "a@x.cl",
    );

    expect(saved.representative.signatureUrl).toBe(
      "https://media.mariohans.cl/f.png?v=1",
    );
    expect(saved.representative.signatureUpdatedAt).not.toBe("");
    const upsert = state.calls.find((c) => c.op === "upsert")!.args as any;
    expect(upsert.data.representative.signatureUrl).toBe(
      "https://media.mariohans.cl/f.png?v=1",
    );
    // The other sections are preserved.
    expect(upsert.data.bank).toEqual(DEFAULT_SETTINGS.bank);
  });
});

describe("SiteSettingsService.getPublicProfile", () => {
  it("returns only the seven public string fields", async () => {
    state.read = {
      data: {
        data: {
          company: {
            legalName: "ACME SpA",
            tradeName: "Acme",
            rut: "76.000.000-0",
            domicilio: "Calle 1",
          },
          representative: {
            name: "Ana Perez",
            signatureUrl: "https://x/s.png",
          },
          contact: {
            email: "privacidad@acme.cl",
            phone: "+56911112222",
            adminNotificationEmail: "admin@acme.cl",
          },
          bank: { accountNumber: "123" },
        },
      },
      error: null,
    };

    const profile = await SiteSettingsService.getPublicProfile();

    expect(profile).toEqual({
      legalName: "ACME SpA",
      tradeName: "Acme",
      rut: "76.000.000-0",
      representativeName: "Ana Perez",
      contactEmail: "privacidad@acme.cl",
      phone: "+56911112222",
      domicilio: "Calle 1",
    });
    expect(JSON.stringify(profile)).not.toMatch(/admin@acme|123|s\.png/);
  });

  it("uses empty strings for unset values", async () => {
    const profile = await SiteSettingsService.getPublicProfile();
    for (const value of Object.values(profile)) {
      expect(typeof value).toBe("string");
    }
    expect(Object.keys(profile).sort()).toEqual(
      [
        "contactEmail",
        "domicilio",
        "legalName",
        "phone",
        "representativeName",
        "rut",
        "tradeName",
      ].sort(),
    );
  });
});
