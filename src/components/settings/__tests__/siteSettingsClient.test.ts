import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "../../../lib/siteSettings";
import {
  SIGNATURE_MAX_BYTES,
  addPickupAddress,
  removePickupAddress,
  saveSiteSettings,
  setPickupAddress,
  setSectionField,
  uploadSignature,
  validateSignatureFile,
} from "../siteSettingsClient";

/**
 * Pure logic behind `SiteSettingsForm`. The project has no jsdom / testing-library (see
 * vitest.config.ts), so interactions are covered here as functions and the markup is covered by
 * `SiteSettingsForm.test.tsx` with `react-dom/server`.
 */
describe("validateSignatureFile", () => {
  it("accepts PNG and JPEG within the size limit", () => {
    expect(
      validateSignatureFile({ name: "f.png", type: "image/png", size: 1000 }),
    ).toBeNull();
    expect(
      validateSignatureFile({
        name: "f.jpg",
        type: "image/jpeg",
        size: SIGNATURE_MAX_BYTES,
      }),
    ).toBeNull();
  });

  it("rejects a .txt file", () => {
    expect(
      validateSignatureFile({
        name: "firma.txt",
        type: "text/plain",
        size: 10,
      }),
    ).toBe("La firma debe ser una imagen PNG o JPEG");
  });

  it("rejects a file larger than 1 MB", () => {
    expect(
      validateSignatureFile({
        name: "f.png",
        type: "image/png",
        size: SIGNATURE_MAX_BYTES + 1,
      }),
    ).toBe("La firma no puede pesar más de 1 MB");
  });

  it("rejects an empty file", () => {
    expect(
      validateSignatureFile({ name: "f.png", type: "image/png", size: 0 }),
    ).toBe("El archivo está vacío");
  });
});

describe("settings state helpers", () => {
  it("sets a field without mutating the previous state", () => {
    const next = setSectionField(
      DEFAULT_SETTINGS,
      "bank",
      "accountNumber",
      "123",
    );
    expect(next.bank.accountNumber).toBe("123");
    expect(DEFAULT_SETTINGS.bank.accountNumber).toBe("8140915407");
    expect(next.company).toBe(DEFAULT_SETTINGS.company);
  });

  it("edits, adds and removes pickup addresses within the 1 to 5 limit", () => {
    let next = setPickupAddress(DEFAULT_SETTINGS, 0, "Nueva 1");
    expect(next.pickupAddresses[0]).toBe("Nueva 1");

    next = addPickupAddress(next);
    expect(next.pickupAddresses).toHaveLength(3);
    expect(next.pickupAddresses[2]).toBe("");

    let full = DEFAULT_SETTINGS;
    for (let i = 0; i < 10; i += 1) full = addPickupAddress(full);
    expect(full.pickupAddresses).toHaveLength(5);

    let single = removePickupAddress(DEFAULT_SETTINGS, 0);
    expect(single.pickupAddresses).toEqual(["Bellavista 77, Recoleta"]);
    single = removePickupAddress(single, 0);
    expect(single.pickupAddresses).toHaveLength(1);
  });
});

describe("saveSiteSettings", () => {
  it("PUTs the edited values and returns the saved settings", async () => {
    const edited = setSectionField(
      DEFAULT_SETTINGS,
      "bank",
      "accountNumber",
      "999",
    );
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: edited }), {
          status: 200,
        }),
      );

    const saved = await saveSiteSettings(request, edited);

    expect(saved).toEqual(edited);
    const [url, init] = request.mock.calls[0];
    expect(url).toBe("/api/admin/site-settings");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body).bank.accountNumber).toBe("999");
  });

  it("throws the server message on a 400", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ success: false, error: "Hay datos inválidos" }),
          { status: 400 },
        ),
      );
    await expect(saveSiteSettings(request, DEFAULT_SETTINGS)).rejects.toThrow(
      "Hay datos inválidos",
    );
  });

  it("throws a generic Spanish message when the response is not JSON", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(new Response("<html>", { status: 502 }));
    await expect(saveSiteSettings(request, DEFAULT_SETTINGS)).rejects.toThrow(
      "No se pudo guardar la configuración",
    );
  });
});

describe("uploadSignature", () => {
  it("does not call the server for an invalid file", async () => {
    const request = vi.fn();
    const file = new File(["hello"], "firma.txt", { type: "text/plain" });
    await expect(uploadSignature(request, file)).rejects.toThrow(
      "La firma debe ser una imagen PNG o JPEG",
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("posts the file as multipart and returns the representative section", async () => {
    const representative = {
      ...DEFAULT_SETTINGS.representative,
      signatureUrl: "https://m.test/f.png?v=1",
    };
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: representative }), {
          status: 200,
        }),
      );
    const file = new File([new Uint8Array([0x89, 0x50])], "firma.png", {
      type: "image/png",
    });

    const result = await uploadSignature(request, file);

    expect(result).toEqual(representative);
    const [url, init] = request.mock.calls[0];
    expect(url).toBe("/api/admin/site-settings/signature");
    expect(init.method).toBe("POST");
    expect((init.body as FormData).get("file")).toBeInstanceOf(Blob);
    // The browser sets the multipart boundary: no manual Content-Type.
    expect(init.headers).toBeUndefined();
  });

  it("throws the server message when the upload fails", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: "No se pudo subir la firma.",
          }),
          { status: 502 },
        ),
      );
    const file = new File([new Uint8Array([0x89, 0x50])], "firma.png", {
      type: "image/png",
    });
    await expect(uploadSignature(request, file)).rejects.toThrow(
      "No se pudo subir la firma.",
    );
  });
});
