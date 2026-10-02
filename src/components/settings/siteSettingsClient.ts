import type { SiteSettings } from "../../lib/siteSettings";

/**
 * Client-side logic of `SiteSettingsForm`, kept out of the component so it can be tested without
 * a DOM: state helpers, signature file checks and the two API calls. `request` is injected
 * (the component passes a `fetch` with credentials) for the same reason.
 */

export const SIGNATURE_MAX_BYTES = 1024 * 1024;
export const MAX_PICKUP_ADDRESSES = 5;

const SIGNATURE_TYPES = ["image/png", "image/jpeg"];

export type RequestFn = (url: string, init: RequestInit) => Promise<Response>;

/** First-pass check before uploading; the server re-checks the magic bytes and stays the authority. */
export function validateSignatureFile(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (!SIGNATURE_TYPES.includes(file.type))
    return "La firma debe ser una imagen PNG o JPEG";
  if (file.size === 0) return "El archivo está vacío";
  if (file.size > SIGNATURE_MAX_BYTES)
    return "La firma no puede pesar más de 1 MB";
  return null;
}

type FieldSection = Exclude<keyof SiteSettings, "pickupAddresses">;

export function setSectionField<
  S extends FieldSection,
  K extends keyof SiteSettings[S],
>(
  settings: SiteSettings,
  section: S,
  field: K,
  value: SiteSettings[S][K],
): SiteSettings {
  return { ...settings, [section]: { ...settings[section], [field]: value } };
}

export function setPickupAddress(
  settings: SiteSettings,
  index: number,
  value: string,
): SiteSettings {
  return {
    ...settings,
    pickupAddresses: settings.pickupAddresses.map((a, i) =>
      i === index ? value : a,
    ),
  };
}

export function addPickupAddress(settings: SiteSettings): SiteSettings {
  if (settings.pickupAddresses.length >= MAX_PICKUP_ADDRESSES) return settings;
  return { ...settings, pickupAddresses: [...settings.pickupAddresses, ""] };
}

export function removePickupAddress(
  settings: SiteSettings,
  index: number,
): SiteSettings {
  if (settings.pickupAddresses.length <= 1) return settings;
  return {
    ...settings,
    pickupAddresses: settings.pickupAddresses.filter((_, i) => i !== index),
  };
}

async function readEnvelope(
  response: Response,
): Promise<{ success?: boolean; data?: any; error?: string }> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function saveSiteSettings(
  request: RequestFn,
  settings: SiteSettings,
): Promise<SiteSettings> {
  const response = await request("/api/admin/site-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  const body = await readEnvelope(response);
  if (!response.ok || !body.success) {
    throw new Error(body.error || "No se pudo guardar la configuración");
  }
  return body.data as SiteSettings;
}

export async function uploadSignature(
  request: RequestFn,
  file: File,
): Promise<SiteSettings["representative"]> {
  const invalid = validateSignatureFile(file);
  if (invalid) throw new Error(invalid);

  const form = new FormData();
  form.append("file", file);
  // No Content-Type header: the browser must add the multipart boundary itself.
  const response = await request("/api/admin/site-settings/signature", {
    method: "POST",
    body: form,
  });
  const body = await readEnvelope(response);
  if (!response.ok || !body.success) {
    throw new Error(body.error || "No se pudo subir la firma");
  }
  return body.data as SiteSettings["representative"];
}
