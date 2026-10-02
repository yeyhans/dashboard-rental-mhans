import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS,
  parseSiteSettings,
  siteSettingsSchema,
  withDefaults,
} from "../siteSettings";

describe("DEFAULT_SETTINGS", () => {
  it("satisfies its own schema", () => {
    expect(siteSettingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
  });

  it("carries the constants that were hardcoded before", () => {
    expect(DEFAULT_SETTINGS.bank.accountNumber).toBe("8140915407");
    expect(DEFAULT_SETTINGS.bank.accountType).toBe("Cuenta Corriente");
    expect(DEFAULT_SETTINGS.representative.name).toBe(
      "Mario Alberto Hans Salinas",
    );
    expect(DEFAULT_SETTINGS.representative.cedula).toBe("16.135.586-0");
    expect(DEFAULT_SETTINGS.representative.signatureUrl).toBe(
      "https://media.mariohans.cl/firmas/firma_mario_hans.png",
    );
    expect(DEFAULT_SETTINGS.pickupAddresses).toEqual([
      "Purísima 25, Recoleta",
      "Bellavista 77, Recoleta",
    ]);
    expect(DEFAULT_SETTINGS.contact.whatsapp).toBe("+56990818976");
    expect(DEFAULT_SETTINGS.contact.adminNotificationEmail).toBe(
      "rental.mariohans@gmail.com",
    );
    expect(DEFAULT_SETTINGS.reserve.defaultPct).toBe(25);
  });
});

describe("withDefaults", () => {
  it("returns the defaults for empty or non-object input", () => {
    expect(withDefaults(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(withDefaults(null)).toEqual(DEFAULT_SETTINGS);
    expect(withDefaults("nope")).toEqual(DEFAULT_SETTINGS);
    expect(withDefaults({})).toEqual(DEFAULT_SETTINGS);
  });

  it("merges a partial section field by field", () => {
    const merged = withDefaults({ bank: { accountNumber: "123" } });
    expect(merged.bank.accountNumber).toBe("123");
    expect(merged.bank.holder).toBe(DEFAULT_SETTINGS.bank.holder);
  });

  it("replaces the pickup list instead of merging it", () => {
    const merged = withDefaults({ pickupAddresses: ["Only one 1"] });
    expect(merged.pickupAddresses).toEqual(["Only one 1"]);
  });

  it("ignores unknown sections and a section that is not an object", () => {
    const merged = withDefaults({ extra: { a: 1 }, company: "x" });
    expect(merged).toEqual(DEFAULT_SETTINGS);
    expect(merged).not.toHaveProperty("extra");
  });
});

describe("parseSiteSettings", () => {
  it("accepts a partial payload and fills the rest", () => {
    const { settings, error } = parseSiteSettings({
      reserve: { defaultPct: 30 },
    });
    expect(error).toBeNull();
    expect(settings.reserve.defaultPct).toBe(30);
    expect(settings.bank).toEqual(DEFAULT_SETTINGS.bank);
  });

  it("trims strings", () => {
    const { settings, error } = parseSiteSettings({
      company: { legalName: "  Foto SpA  " },
    });
    expect(error).toBeNull();
    expect(settings.company.legalName).toBe("Foto SpA");
  });

  it("rejects an invalid email with a Spanish message", () => {
    const { settings, error } = parseSiteSettings({
      contact: { email: "not-an-email" },
    });
    expect(error).not.toBeNull();
    expect(error!.issues[0]).toEqual({
      path: "contact.email",
      message: "Correo electrónico inválido",
    });
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it("rejects a website that is not http(s)", () => {
    const { error } = parseSiteSettings({ contact: { website: "ftp://x.cl" } });
    expect(error!.issues[0].path).toBe("contact.website");
  });

  it("rejects a malformed RUT but allows an empty one", () => {
    expect(parseSiteSettings({ company: { rut: "12" } }).error).not.toBeNull();
    expect(parseSiteSettings({ company: { rut: "" } }).error).toBeNull();
    expect(
      parseSiteSettings({ company: { rut: "77.892.569-9" } }).error,
    ).toBeNull();
  });

  it("requires 1 to 5 pickup addresses", () => {
    expect(parseSiteSettings({ pickupAddresses: [] }).error).not.toBeNull();
    expect(
      parseSiteSettings({
        pickupAddresses: ["a1", "b2", "c3", "d4", "e5", "f6"],
      }).error,
    ).not.toBeNull();
    expect(parseSiteSettings({ pickupAddresses: ["  "] }).error).not.toBeNull();
    expect(
      parseSiteSettings({ pickupAddresses: ["a1", "b2", "c3", "d4", "e5"] })
        .error,
    ).toBeNull();
  });

  it("requires the reserve to be an integer between 0 and 100", () => {
    expect(
      parseSiteSettings({ reserve: { defaultPct: -1 } }).error,
    ).not.toBeNull();
    expect(
      parseSiteSettings({ reserve: { defaultPct: 101 } }).error,
    ).not.toBeNull();
    expect(
      parseSiteSettings({ reserve: { defaultPct: 12.5 } }).error,
    ).not.toBeNull();
    expect(parseSiteSettings({ reserve: { defaultPct: 0 } }).error).toBeNull();
    expect(
      parseSiteSettings({ reserve: { defaultPct: 100 } }).error,
    ).toBeNull();
  });

  it("allows clearing the signature url", () => {
    const { settings, error } = parseSiteSettings({
      representative: { signatureUrl: "" },
    });
    expect(error).toBeNull();
    expect(settings.representative.signatureUrl).toBe("");
  });
});
